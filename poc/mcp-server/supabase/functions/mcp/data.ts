// Supabase implementation of FixtureRepo over a privileged client.
// All queries are parameterized supabase-js calls; no SQL is built from
// definition content. Membership is checked explicitly in core.ts.
import type { AppRow, DefinitionDoc, FixtureRepo, ItemRow, LogRow, PackRow } from "./core.ts";

// Minimal structural type for the supabase-js client surface used here.
// deno-lint-ignore no-explicit-any
type Client = any;

function unwrap<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw new Error("database query failed");
  return result.data;
}

export function createSupabaseRepo(client: Client): FixtureRepo {
  return {
    async resolveOrCreateAccount(normalizedEmail: string): Promise<string> {
      const data = unwrap(await client.from("poc_accounts").upsert({ normalized_email: normalizedEmail }, { onConflict: "normalized_email" }).select("id").single());
      return (data as { id: string }).id;
    },
    async loadApp(appId: string): Promise<AppRow | null> {
      const data = unwrap(await client.from("poc_apps").select("id,name,summary,current_version,environments").eq("id", appId).maybeSingle());
      return (data as AppRow | null) ?? null;
    },
    async listMemberApps(accountId: string): Promise<AppRow[]> {
      const rows = unwrap(await client.from("poc_app_memberships").select("app_id").eq("account_id", accountId)) ?? [];
      const apps: AppRow[] = [];
      for (const row of rows as Array<{ app_id: string }>) {
        const data = unwrap(await client.from("poc_apps").select("id,name,summary,current_version,environments").eq("id", row.app_id).maybeSingle());
        if (data) apps.push(data as AppRow);
      }
      return apps;
    },
    async loadDefinition(appId: string, version: number): Promise<DefinitionDoc | null> {
      const data = unwrap(await client.from("poc_app_definitions").select("definition").eq("app_id", appId).eq("version", version).maybeSingle());
      return (data as { definition: DefinitionDoc } | null)?.definition ?? null;
    },
    async loadPack(packId: string): Promise<PackRow | null> {
      const data = unwrap(await client.from("poc_packs").select("id,kind,app_id,version,title,instructions").eq("id", packId).maybeSingle());
      return (data as PackRow | null) ?? null;
    },
    async isMember(appId: string, accountId: string): Promise<boolean> {
      const data = unwrap(await client.from("poc_app_memberships").select("app_id").eq("app_id", appId).eq("account_id", accountId).maybeSingle());
      return data !== null && data !== undefined;
    },
    async listItems(appId: string): Promise<ItemRow[]> {
      const data = unwrap(await client.from("poc_grocery_items").select("id,name,quantity").eq("app_id", appId).order("id", { ascending: true }));
      return (data as ItemRow[]) ?? [];
    },
    async insertItem(appId: string, fields: Record<string, unknown>): Promise<ItemRow> {
      const data = unwrap(await client.from("poc_grocery_items").insert({ app_id: appId, ...fields }).select("id,name,quantity").single());
      return data as ItemRow;
    },
    async deleteItems(appId: string, criteria: Record<string, unknown>): Promise<ItemRow[]> {
      let del = client.from("poc_grocery_items").delete().eq("app_id", appId);
      for (const [key, value] of Object.entries(criteria)) del = del.eq(key, value);
      const data = unwrap(await del.select("id,name,quantity"));
      return (data as ItemRow[]) ?? [];
    },
    async insertLog(row: LogRow): Promise<void> {
      unwrap(await client.from("poc_tool_call_log").insert({
        account_id: row.account_id, app_id: row.app_id, operation: row.operation,
        app_version: row.app_version, environment: row.environment,
        outcome: row.outcome, error_code: row.error_code,
      }));
    },
  };
}
