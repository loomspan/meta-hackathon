// Pure core for the Gate 1 MCP tools. No imports: testable in isolation.
// Behavior is driven by the stored definition's declarative effect field;
// this file never dispatches on an operation name.

export interface ArgumentDef {
  name: string;
  type: string;
  required?: boolean;
  min_length?: number;
  trim?: boolean;
  minimum?: number;
}
export interface EffectDef {
  action: string;
  resource: string;
  order?: Array<{ field: string; direction: string }>;
  fields?: string[];
  match?: string[];
}
export interface OperationDef {
  name: string;
  kind: string;
  description: string;
  arguments: ArgumentDef[];
  effect?: EffectDef;
}
export interface DefinitionDoc { operations: OperationDef[]; }
export interface AppRow {
  id: string; name: string; summary: string;
  current_version: number; environments: string[];
}
export interface PackRow {
  id: string; kind: string; app_id: string | null;
  version: number; title: string; instructions: string;
}
export interface ItemRow { id: number; name: string; quantity: number; }
export interface LogRow {
  user_id: string | null; app_id: string | null; operation: string | null;
  app_version: number | null; environment: string | null;
  outcome: string; error_code: string | null;
}

export interface FixtureRepo {
  loadApp(appId: string): Promise<AppRow | null>;
  listMemberApps(userId: string): Promise<AppRow[]>;
  loadDefinition(appId: string, version: number): Promise<DefinitionDoc | null>;
  loadPack(packId: string): Promise<PackRow | null>;
  isMember(appId: string, userId: string): Promise<boolean>;
  listItems(appId: string): Promise<ItemRow[]>;
  insertItem(appId: string, fields: Record<string, unknown>): Promise<ItemRow>;
  deleteItems(appId: string, criteria: Record<string, unknown>): Promise<ItemRow[]>;
  insertLog(row: LogRow): Promise<void>;
}

export type Payload = Record<string, unknown> & { ok: boolean };

const STALE_GUIDANCE = "Call get_pack for this app, then retry once with the current app_version.";
const FIX_GUIDANCE = "Correct the request or ask the user for the missing value; do not invent values.";

function err(errorCode: string, guidance: string, extra: Record<string, unknown> = {}): Payload {
  return { ok: false, error_code: errorCode, guidance, ...extra };
}
function invalidDefinition(detail: string): Payload {
  return err("invalid_definition", `The stored app definition is not executable (${detail}). Correct the definition; no operation was run.`);
}

export function shapeLogRow(row: LogRow): LogRow {
  return {
    user_id: row.user_id ?? null,
    app_id: row.app_id ?? null,
    operation: row.operation ?? null,
    app_version: typeof row.app_version === "number" && Number.isInteger(row.app_version) ? row.app_version : null,
    environment: row.environment ?? null,
    outcome: row.outcome,
    error_code: row.error_code ?? null,
  };
}

export async function safeInsertLog(repo: FixtureRepo, row: LogRow): Promise<void> {
  try {
    await repo.insertLog(shapeLogRow(row));
  } catch {
    console.error("tool-call log write failed");
  }
}

function outcomeFor(payload: Payload): { outcome: string; error_code: string | null } {
  if (payload.ok) return { outcome: "ok", error_code: null };
  const code = typeof payload.error_code === "string" ? payload.error_code : "internal_error";
  if (code === "invalid_definition" || code === "internal_error") return { outcome: "error", error_code: code };
  return { outcome: "rejected", error_code: code };
}

async function finish(
  repo: FixtureRepo,
  base: Omit<LogRow, "outcome" | "error_code">,
  payload: Payload,
): Promise<Payload> {
  const { outcome, error_code } = outcomeFor(payload);
  await safeInsertLog(repo, { ...base, outcome, error_code });
  return payload;
}

// --- Argument validation -------------------------------------------------

export function validateArguments(
  operation: OperationDef,
  args: unknown,
): { ok: true; values: Record<string, unknown> } | { ok: false; payload: Payload } {
  if (args === undefined || args === null) args = {};
  if (typeof args !== "object" || Array.isArray(args)) {
    return { ok: false, payload: err("invalid_arguments", `Invalid arguments: 'arguments' must be an object. ${FIX_GUIDANCE}`) };
  }
  const record = args as Record<string, unknown>;
  const defs = Array.isArray(operation.arguments) ? operation.arguments : [];
  const known = new Set(defs.map((d) => d.name));
  for (const key of Object.keys(record)) {
    if (!known.has(key)) {
      return { ok: false, payload: err("invalid_arguments", `Invalid argument '${key}': not defined for this operation. ${FIX_GUIDANCE}`) };
    }
  }
  const values: Record<string, unknown> = {};
  for (const def of defs) {
    const raw = record[def.name];
    if (raw === undefined) {
      if (def.required) {
        return { ok: false, payload: err("invalid_arguments", `Invalid argument '${def.name}': a value is required. ${FIX_GUIDANCE}`) };
      }
      continue;
    }
    if (def.type === "string") {
      if (typeof raw !== "string") {
        return { ok: false, payload: err("invalid_arguments", `Invalid argument '${def.name}': must be a string. ${FIX_GUIDANCE}`) };
      }
      const value = def.trim ? raw.trim() : raw;
      if (typeof def.min_length === "number" && value.length < def.min_length) {
        return { ok: false, payload: err("invalid_arguments", `Invalid argument '${def.name}': must be at least ${def.min_length} character(s) after trimming. ${FIX_GUIDANCE}`) };
      }
      values[def.name] = value;
    } else if (def.type === "integer") {
      if (typeof raw !== "number" || !Number.isInteger(raw)) {
        return { ok: false, payload: err("invalid_arguments", `Invalid argument '${def.name}': must be a whole-number integer. ${FIX_GUIDANCE}`) };
      }
      if (typeof def.minimum === "number" && raw < def.minimum) {
        return { ok: false, payload: err("invalid_arguments", `Invalid argument '${def.name}': must be at least ${def.minimum}. ${FIX_GUIDANCE}`) };
      }
      values[def.name] = raw;
    } else {
      return { ok: false, payload: invalidDefinition(`unsupported argument type '${def.type}'`) };
    }
  }
  return { ok: true, values };
}

// --- Effect validation ---------------------------------------------------

const COLUMN_ALLOWLIST = new Set(["name", "quantity"]);
const MATCH_ALLOWLIST = new Set(["name", "quantity", "id"]);

export function validateEffect(operation: OperationDef): Payload | null {
  const effect = operation.effect;
  if (!effect || typeof effect !== "object") return invalidDefinition("missing effect");
  if (effect.resource !== "grocery_items") return invalidDefinition("resource is not allowed");
  const declared = new Set((operation.arguments ?? []).map((d) => d.name));
  if (effect.action === "list") {
    const order = effect.order ?? [{ field: "id", direction: "asc" }];
    if (!Array.isArray(order)) return invalidDefinition("order must be a list");
    for (const entry of order) {
      if (!entry || entry.field !== "id" || !["asc", "desc"].includes(entry.direction)) {
        return invalidDefinition("order field is not allowed");
      }
    }
    return null;
  }
  const requiredByName = new Map((operation.arguments ?? []).map((d) => [d.name, d.required === true]));
  if (effect.action === "insert") {
    if (!Array.isArray(effect.fields) || effect.fields.length === 0) return invalidDefinition("insert requires fields");
    for (const f of effect.fields) {
      if (!declared.has(f) || !COLUMN_ALLOWLIST.has(f)) return invalidDefinition(`insert field '${f}' is not allowed`);
      if (!requiredByName.get(f)) return invalidDefinition(`insert field '${f}' must be a required argument`);
    }
    return null;
  }
  if (effect.action === "delete") {
    if (!Array.isArray(effect.match) || effect.match.length === 0) return invalidDefinition("delete requires match");
    for (const f of effect.match) {
      if (!declared.has(f) || !MATCH_ALLOWLIST.has(f)) return invalidDefinition(`match field '${f}' is not allowed`);
      if (!requiredByName.get(f)) return invalidDefinition(`match field '${f}' must be a required argument`);
    }
    return null;
  }
  return invalidDefinition(`action '${effect.action}' is not allowed`);
}

// --- Generic executor ----------------------------------------------------

export async function executeOperation(
  repo: FixtureRepo,
  appId: string,
  operation: OperationDef,
  values: Record<string, unknown>,
): Promise<Payload> {
  const effect = operation.effect as EffectDef;
  if (effect.action === "list") {
    const items = await repo.listItems(appId);
    const direction = effect.order?.[0]?.direction === "desc" ? -1 : 1;
    const sorted = [...items].sort((a, b) => (a.id - b.id) * direction);
    return { ok: true, items: sorted.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity })) };
  }
  if (effect.action === "insert") {
    const fields: Record<string, unknown> = {};
    for (const f of effect.fields ?? []) fields[f] = values[f];
    const item = await repo.insertItem(appId, fields);
    return { ok: true, item: { id: item.id, name: item.name, quantity: item.quantity } };
  }
  const criteria: Record<string, unknown> = {};
  for (const f of effect.match ?? []) criteria[f] = values[f];
  const removed = await repo.deleteItems(appId, criteria);
  if (removed.length === 0) {
    return err("item_not_found", "No matching item was found. Call the list operation first to see the current items, then retry with an exact match.");
  }
  return { ok: true, removed: removed.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity })) };
}

// --- Tool handlers ---------------------------------------------------------

export async function handleListApps(repo: FixtureRepo, userId: string): Promise<Payload> {
  const base = { user_id: userId, app_id: null, operation: "list_apps", app_version: null, environment: null };
  try {
    const apps = await repo.listMemberApps(userId);
    return await finish(repo, base, {
      ok: true,
      apps: apps.map((a) => ({ app_id: a.id, name: a.name, version: a.current_version, summary: a.summary, environments: a.environments })),
    });
  } catch {
    return await finish(repo, base, err("internal_error", "The request could not be completed. Retry the request."));
  }
}

export async function handleGetPack(repo: FixtureRepo, userId: string, packId: unknown): Promise<Payload> {
  const base = { user_id: userId, app_id: null as string | null, operation: "get_pack", app_version: null as number | null, environment: null };
  try {
    if (typeof packId !== "string" || packId.length === 0) {
      return await finish(repo, base, err("unknown_pack", "No pack was identified. Use a pack ID returned for this user, then retry."));
    }
    const pack = await repo.loadPack(packId);
    if (!pack) {
      return await finish(repo, base, err("unknown_pack", `Unknown pack '${packId}'. Check the pack ID and retry.`));
    }
    if (pack.kind !== "app") {
      return await finish(repo, base, {
        ok: true,
        pack: { pack_id: pack.id, kind: pack.kind, app_id: pack.app_id, version: pack.version, title: pack.title, instructions: pack.instructions },
      });
    }
    const appId = pack.app_id ?? pack.id;
    base.app_id = appId;
    if (!(await repo.isMember(appId, userId))) {
      return await finish(repo, base, err("not_member", "The signed-in user is not a member of this app. Ask the app owner for access; no app data was returned."));
    }
    const app = await repo.loadApp(appId);
    if (!app) return await finish(repo, base, err("unknown_app", `Unknown app '${appId}'. Call list_apps to see the available apps.`));
    base.app_version = app.current_version;
    const definition = await repo.loadDefinition(appId, app.current_version);
    if (!definition || !Array.isArray(definition.operations)) {
      return await finish(repo, base, invalidDefinition("definition row missing at the current version"));
    }
    const operations = definition.operations.map((o) => ({
      name: o.name, kind: o.kind, description: o.description, arguments: o.arguments ?? [],
    }));
    return await finish(repo, base, {
      ok: true,
      pack: { pack_id: pack.id, kind: pack.kind, app_id: appId, version: app.current_version, title: pack.title, instructions: pack.instructions },
      operations,
    });
  } catch {
    return await finish(repo, base, err("internal_error", "The request could not be completed. Retry the request."));
  }
}

export interface CallOperationInput {
  app_id?: unknown;
  environment?: unknown;
  app_version?: unknown;
  operation?: unknown;
  arguments?: unknown;
}

export async function handleCallOperation(repo: FixtureRepo, userId: string, input: CallOperationInput): Promise<Payload> {
  const requestedApp = typeof input?.app_id === "string" ? input.app_id : null;
  const requestedOp = typeof input?.operation === "string" ? input.operation : null;
  const logVersion = typeof input?.app_version === "number" && Number.isInteger(input.app_version) ? input.app_version : null;
  const logEnv = input?.environment === undefined ? "production" : (typeof input.environment === "string" ? input.environment : null);
  const base = { user_id: userId, app_id: requestedApp, operation: requestedOp, app_version: logVersion, environment: logEnv };
  try {
    if (!requestedApp) {
      return await finish(repo, base, err("unknown_app", "No app was identified. Call list_apps to see the available apps, then retry."));
    }
    const app = await repo.loadApp(requestedApp);
    if (!app) {
      return await finish(repo, base, err("unknown_app", `Unknown app '${requestedApp}'. Call list_apps to see the available apps, then retry.`));
    }
    if (!(await repo.isMember(requestedApp, userId))) {
      return await finish(repo, base, err("not_member", "The signed-in user is not a member of this app. Ask the app owner for access; no operation was run."));
    }
    if (typeof input.app_version !== "number" || !Number.isInteger(input.app_version)) {
      return await finish(repo, base, err("invalid_arguments", `Invalid argument 'app_version': must be an integer equal to the current app version. Call get_pack for this app to get the current version. ${FIX_GUIDANCE}`));
    }
    if (input.app_version !== app.current_version) {
      return await finish(repo, base, { ok: false, error_code: "stale_version", current_version: app.current_version, guidance: STALE_GUIDANCE });
    }
    const definition = await repo.loadDefinition(requestedApp, app.current_version);
    if (!definition || !Array.isArray(definition.operations)) {
      return await finish(repo, base, invalidDefinition("definition row missing at the current version"));
    }
    const operation = definition.operations.find((o) => o.name === requestedOp);
    if (!operation) {
      return await finish(repo, base, err("unknown_operation", `Unknown operation '${requestedOp ?? ""}'. Call get_pack for this app to see the current operations, then retry.`));
    }
    base.operation = operation.name;
    const environment = input.environment === undefined ? "production" : input.environment;
    if (typeof environment !== "string" || !app.environments.includes(environment)) {
      return await finish(repo, base, err("invalid_arguments", `Invalid argument 'environment': must be one of ${app.environments.join(", ")}. ${FIX_GUIDANCE}`));
    }
    base.environment = environment;
    const validated = validateArguments(operation, input.arguments ?? {});
    if (!validated.ok) return await finish(repo, base, validated.payload);
    const effectError = validateEffect(operation);
    if (effectError) return await finish(repo, base, effectError);
    const result = await executeOperation(repo, requestedApp, operation, validated.values);
    if (!result.ok) return await finish(repo, base, result);
    const { ok: _ok, ...rest } = result;
    return await finish(repo, base, {
      ok: true, app_id: requestedApp, app_version: app.current_version, environment, operation: operation.name, ...rest,
    });
  } catch {
    return await finish(repo, base, err("internal_error", "The request could not be completed. Retry the request; if a write may have been attempted, read the current state before retrying it."));
  }
}

// --- Unauthenticated (pre-handler) log shaping -----------------------------

export interface ExtractedCall {
  tool: string;
  app_id: string | null;
  operation: string | null;
  app_version: number | null;
  environment: string | null;
}

export function extractLogFieldsFromToolCall(bodyText: string): ExtractedCall | null {
  let parsed: unknown;
  try { parsed = JSON.parse(bodyText); } catch { return null; }
  if (!parsed || typeof parsed !== "object") return null;
  const msg = parsed as Record<string, unknown>;
  if (msg.method !== "tools/call") return null;
  const params = (msg.params ?? {}) as Record<string, unknown>;
  const tool = typeof params.name === "string" ? params.name : null;
  if (!tool) return null;
  const args = (params.arguments ?? {}) as Record<string, unknown>;
  if (tool === "call_operation") {
    return {
      tool,
      app_id: typeof args.app_id === "string" ? args.app_id : null,
      operation: typeof args.operation === "string" ? args.operation : null,
      app_version: typeof args.app_version === "number" && Number.isInteger(args.app_version) ? args.app_version : null,
      environment: typeof args.environment === "string" ? args.environment : (args.environment === undefined ? "production" : null),
    };
  }
  return { tool, app_id: null, operation: tool, app_version: null, environment: null };
}

export function unauthenticatedLogRow(extracted: ExtractedCall): LogRow {
  const isCall = extracted.tool === "call_operation";
  return shapeLogRow({
    user_id: null,
    app_id: isCall ? extracted.app_id : null,
    operation: isCall ? extracted.operation : extracted.tool,
    app_version: isCall ? extracted.app_version : null,
    environment: isCall ? extracted.environment : null,
    outcome: "rejected",
    error_code: "unauthenticated",
  });
}
