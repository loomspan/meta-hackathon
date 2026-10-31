// Gate 1 MCP server: exactly list_apps, get_pack, call_operation.
// Composition follows Supabase's Deploy MCP servers guide: OAuth discovery,
// user-token verification, then a fresh MCP server per request.
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@^2.0.0";
import { pipeline } from "npm:@supabase/middleware@1";
import { withOAuthProtectedResource, withSupabase } from "npm:@supabase/server@1";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@^4.3.6";

import {
  extractLogFieldsFromToolCall,
  handleCallOperation,
  handleGetPack,
  handleListApps,
  safeInsertLog,
  unauthenticatedLogRow,
  verifiedAccountEmail,
  type Payload,
} from "./core.ts";
import { createSupabaseRepo } from "./data.ts";

function serviceRepo() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createSupabaseRepo(createClient(url, key));
}

function toolResult(payload: Payload) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
    structuredContent: payload as Record<string, unknown>,
    ...(payload.ok ? {} : { isError: true }),
  };
}

const authenticated = pipeline(
  [withOAuthProtectedResource(), withSupabase({ auth: "user" })],
  async (req: Request, { supabase }: any) => {
    const repo = serviceRepo();
    const { data } = await supabase.auth.getUser();
    const userId: string | null = data?.user?.id ?? null;
    const verifiedEmail = userId ? verifiedAccountEmail(data?.user) : null;
    type Identity = { kind: "account"; accountId: string } | { kind: "unauthenticated" } | { kind: "resolution_failed" };
    let identity: Identity = { kind: "unauthenticated" };
    if (userId && verifiedEmail) {
      try {
        identity = { kind: "account", accountId: await repo.resolveOrCreateAccount(verifiedEmail) };
      } catch {
        identity = { kind: "resolution_failed" };
      }
    }
    const resolutionFailed: Payload = { ok: false, error_code: "internal_error", guidance: "The request could not be completed. Retry the request." };
    const failResolution = async (extracted: Parameters<typeof unauthenticatedLogRow>[0]): Promise<Payload> => {
      const row = unauthenticatedLogRow(extracted);
      await safeInsertLog(repo, { ...row, outcome: "error", error_code: "internal_error" });
      return resolutionFailed;
    };

    const unauthenticated: Payload = { ok: false, error_code: "unauthenticated", guidance: "Sign in and retry the request." };
    const rejectUnauthenticated = async (extracted: Parameters<typeof unauthenticatedLogRow>[0]): Promise<Payload> => {
      await safeInsertLog(repo, unauthenticatedLogRow(extracted));
      return unauthenticated;
    };

    const handler = createMcpHandler(() => {
      const server = new McpServer({ name: "loomspan-poc", version: "0.1.0" });

      server.registerTool(
        "list_apps",
        { description: "List apps the signed-in user is a member of (summaries only).", inputSchema: z.object({}) },
        async () =>
          toolResult(identity.kind === "account"
            ? await handleListApps(repo, identity.accountId)
            : identity.kind === "resolution_failed"
              ? await failResolution({ tool: "list_apps", app_id: null, operation: null, app_version: null, environment: null })
              : await rejectUnauthenticated({ tool: "list_apps", app_id: null, operation: null, app_version: null, environment: null })),
      );

      server.registerTool(
        "get_pack",
        { description: "Get the Build, Run, or selected app pack by pack ID.", inputSchema: z.object({ pack_id: z.unknown().optional() }) },
        async ({ pack_id }: any) =>
          toolResult(identity.kind === "account"
            ? await handleGetPack(repo, identity.accountId, pack_id)
            : identity.kind === "resolution_failed"
              ? await failResolution({ tool: "get_pack", app_id: null, operation: null, app_version: null, environment: null })
              : await rejectUnauthenticated({ tool: "get_pack", app_id: null, operation: null, app_version: null, environment: null })),
      );

      server.registerTool(
        "call_operation",
        {
          description: "Run a named operation from the stored app definition.",
          inputSchema: z.object({
            app_id: z.unknown().optional(),
            environment: z.unknown().optional(),
            app_version: z.unknown().optional(),
            operation: z.unknown().optional(),
            arguments: z.unknown().optional(),
          }),
        },
        async (input: any) =>
          toolResult(identity.kind === "account"
            ? await handleCallOperation(repo, identity.accountId, input)
            : identity.kind === "resolution_failed"
              ? await failResolution({
              tool: "call_operation",
              app_id: typeof input?.app_id === "string" ? input.app_id : null,
              operation: typeof input?.operation === "string" ? input.operation : null,
              app_version: typeof input?.app_version === "number" && Number.isInteger(input.app_version) ? input.app_version : null,
              environment: typeof input?.environment === "string" ? input.environment : null,
            })
            : await rejectUnauthenticated({
              tool: "call_operation",
              app_id: typeof input?.app_id === "string" ? input.app_id : null,
              operation: typeof input?.operation === "string" ? input.operation : null,
              app_version: typeof input?.app_version === "number" && Number.isInteger(input.app_version) ? input.app_version : null,
              environment: typeof input?.environment === "string" ? input.environment : null,
            })),
      );

      return server;
    });

    return handler.fetch(req);
  },
);

// Log pre-handler 401 rejections for parseable tools/call requests only.
// Only tool/app/operation/version/environment are extracted; never args.
async function withUnauthenticatedLogging(req: Request): Promise<Response> {
  let extracted = null as ReturnType<typeof extractLogFieldsFromToolCall>;
  if (req.method === "POST") {
    try {
      extracted = extractLogFieldsFromToolCall(await req.clone().text());
    } catch {
      extracted = null;
    }
  }
  const response = await (authenticated as any)(req);
  if (response.status === 401 && extracted) {
    try {
      await safeInsertLog(serviceRepo(), unauthenticatedLogRow(extracted));
    } catch {
      console.error("tool-call log write failed");
    }
  }
  return response;
}

Deno.serve((req: Request) => withUnauthenticatedLogging(req));
