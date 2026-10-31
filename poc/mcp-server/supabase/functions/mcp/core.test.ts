// Deno tests for the pure MCP core. No DB, network, or token is used.
import {
  handleCallOperation,
  handleGetPack,
  handleListApps,
  normalizeAccountEmail,
  verifiedAccountEmail,
  shapeLogRow,
  unauthenticatedLogRow,
  extractLogFieldsFromToolCall,
  type AppRow,
  type DefinitionDoc,
  type FixtureRepo,
  type ItemRow,
  type LogRow,
  type PackRow,
} from "./core.ts";

function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}
function eq(actual: unknown, expected: unknown, msg = "") {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg} expected ${e}, got ${a}`);
}

const OWNER = "11111111-1111-4111-8111-111111111111";
const NONMEMBER = "22222222-2222-4222-8222-222222222222";

function v1Definition(): DefinitionDoc {
  return {
    operations: [
      { name: "list_items", kind: "read", description: "list", arguments: [], effect: { action: "list", resource: "grocery_items", order: [{ field: "id", direction: "asc" }] } },
      { name: "add_item", kind: "write", description: "add", arguments: [
        { name: "name", type: "string", required: true, min_length: 1, trim: true },
        { name: "quantity", type: "integer", required: true, minimum: 1 },
      ], effect: { action: "insert", resource: "grocery_items", fields: ["name", "quantity"] } },
    ],
  };
}

class FakeRepo implements FixtureRepo {
  app: AppRow = { id: "grocery-list", name: "Grocery List", summary: "A simple synthetic grocery list.", current_version: 1, environments: ["production"] };
  definitions = new Map<string, DefinitionDoc>([["grocery-list:1", v1Definition()]]);
  packs: PackRow[] = [
    { id: "build", kind: "build", app_id: null, version: 1, title: "Loomspan Build", instructions: "Build guidance." },
    { id: "run", kind: "run", app_id: null, version: 1, title: "Loomspan Run", instructions: "Run guidance." },
    { id: "grocery-list", kind: "app", app_id: "grocery-list", version: 1, title: "Grocery List", instructions: "Grocery guidance." },
  ];
  members = new Set([`grocery-list:${OWNER}`]);
  items: ItemRow[] = [
    { id: 1, name: "Oats", quantity: 2 },
    { id: 2, name: "Apples", quantity: 4 },
    { id: 3, name: "Milk", quantity: 1 },
  ];
  nextId = 4;
  mutations = 0;
  itemQueries = 0;
  logs: LogRow[] = [];
  failLog = false;
  accounts = new Map<string, string>([["owner@example.invalid", OWNER]]);
  accountCreations = 0;
  accountSeq = 0;

  async resolveOrCreateAccount(normalizedEmail: string): Promise<string> {
    const existing = this.accounts.get(normalizedEmail);
    if (existing) return existing;
    await new Promise((r) => setTimeout(r, 1));
    const afterDelay = this.accounts.get(normalizedEmail);
    if (afterDelay) return afterDelay;
    this.accountCreations++;
    const id = `account-${++this.accountSeq}`;
    this.accounts.set(normalizedEmail, id);
    return id;
  }
  async loadApp(appId: string): Promise<AppRow | null> { return appId === this.app.id ? this.app : null; }
  async listMemberApps(accountId: string): Promise<AppRow[]> { return this.members.has(`grocery-list:${accountId}`) ? [this.app] : []; }
  async loadDefinition(appId: string, version: number): Promise<DefinitionDoc | null> { return this.definitions.get(`${appId}:${version}`) ?? null; }
  async loadPack(packId: string): Promise<PackRow | null> { return this.packs.find((x) => x.id === packId) ?? null; }
  async isMember(appId: string, accountId: string): Promise<boolean> { return this.members.has(`${appId}:${accountId}`); }
  async listItems(_appId: string): Promise<ItemRow[]> { this.itemQueries++; return [...this.items].sort((a, b) => a.id - b.id); }
  async insertItem(_appId: string, fields: Record<string, unknown>): Promise<ItemRow> {
    const name = fields.name;
    const quantity = fields.quantity;
    if (typeof name !== "string" || typeof quantity !== "number" || !Number.isInteger(quantity)) {
      throw new Error("insertItem received unvalidated fields");
    }
    this.mutations++;
    const item: ItemRow = { id: this.nextId++, name, quantity };
    this.items.push(item);
    return item;
  }
  async deleteItems(_appId: string, criteria: Record<string, unknown>): Promise<ItemRow[]> {
    this.itemQueries++;
    const fieldValue = (item: ItemRow, key: string): unknown =>
      key === "id" ? item.id : key === "name" ? item.name : key === "quantity" ? item.quantity : undefined;
    const removed = this.items.filter((i) => Object.entries(criteria).every(([k, v]) => fieldValue(i, k) === v));
    if (removed.length) { this.mutations++; this.items = this.items.filter((i) => !removed.includes(i)); }
    return removed;
  }
  async insertLog(row: LogRow): Promise<void> {
    if (this.failLog) throw new Error("log unavailable");
    this.logs.push(row);
  }
}

const call = (repo: FakeRepo, user = OWNER, over: any = {}) =>
  handleCallOperation(repo, user, { app_id: "grocery-list", app_version: 1, operation: "list_items", arguments: {}, ...over });

Deno.test("normalizeAccountEmail trims and lowercases only", () => {
  eq(normalizeAccountEmail("  Owner@Example.COM "), "owner@example.com");
  eq(normalizeAccountEmail("owner@example.com"), "owner@example.com");
  assert(normalizeAccountEmail("a+b@example.com") !== normalizeAccountEmail("a@example.com"));
  assert(normalizeAccountEmail("a.b@example.com") !== normalizeAccountEmail("ab@example.com"));
  eq(normalizeAccountEmail("a b@example.com"), "a b@example.com");
  for (const v of ["", "   ", null, undefined, 42]) eq(normalizeAccountEmail(v), null);
});

Deno.test("verifiedAccountEmail requires a confirmed email", () => {
  eq(verifiedAccountEmail({ email: " Owner@Example.com ", email_confirmed_at: "2026-10-30T00:00:00Z" }), "owner@example.com");
  eq(verifiedAccountEmail({ email_confirmed_at: "2026-10-30T00:00:00Z" }), null);
  eq(verifiedAccountEmail({ email: "  ", email_confirmed_at: "2026-10-30T00:00:00Z" }), null);
  eq(verifiedAccountEmail({ email: "a@example.com" }), null);
  eq(verifiedAccountEmail({ email: "a@example.com", email_confirmed_at: null }), null);
  eq(verifiedAccountEmail({ email: 42, email_confirmed_at: "2026-10-30T00:00:00Z" }), null);
  eq(verifiedAccountEmail(null), null);
});

Deno.test("first resolution creates one account and reuses it for the same normalized email", async () => {
  const repo = new FakeRepo();
  const e1 = verifiedAccountEmail({ email: " New@Example.com ", email_confirmed_at: "2026-10-30T00:00:00Z" });
  assert(e1);
  const id1 = await repo.resolveOrCreateAccount(e1);
  const id2 = await repo.resolveOrCreateAccount("new@example.com");
  eq(id2, id1); eq(repo.accountCreations, 1);
  eq((await handleListApps(repo, id1) as any).apps, []);
  repo.members.add(`grocery-list:${id1}`);
  eq((await handleListApps(repo, id1) as any).apps.length, 1);
  const other = await repo.resolveOrCreateAccount("other@example.com");
  assert(other !== id1); eq(repo.accountCreations, 2);
  eq((await handleListApps(repo, other) as any).apps, []);
  eq((await handleGetPack(repo, other, "grocery-list") as any).error_code, "not_member");
  // Old Supabase-style ID with no membership authorizes as non-member.
  eq((await handleListApps(repo, NONMEMBER) as any).apps, []);
  // Concurrent first resolutions return one ID with one creation.
  const ids = await Promise.all(Array.from({ length: 8 }, () => repo.resolveOrCreateAccount("race@example.invalid")));
  assert(ids.every((x) => x === ids[0])); eq(repo.accountCreations, 3);
});

Deno.test("an email supplied as a tool argument is never identity evidence", async () => {
  const repo = new FakeRepo();
  // Membership precedes argument validation (preserved ordering): the
  // non-member stays a non-member and is never upgraded by the email value.
  const res: any = await call(repo, NONMEMBER, { operation: "list_items", arguments: { email: "owner@example.invalid" } });
  eq(res.error_code, "not_member"); eq(repo.itemQueries, 0); eq(repo.mutations, 0);
  // For a member, the undeclared email key is rejected before any query/mutation.
  const ownerRepo = new FakeRepo();
  const spoof: any = await call(ownerRepo, OWNER, { operation: "list_items", arguments: { email: "other@example.invalid" } });
  eq(spoof.error_code, "invalid_arguments"); eq(ownerRepo.itemQueries, 0); eq(ownerRepo.mutations, 0);
  const ok: any = await call(repo, OWNER, { operation: "list_items", arguments: {} });
  eq(ok.ok, true);
});

Deno.test("owner lists in insertion order, adds, persists", async () => {
  const repo = new FakeRepo();
  const listed: any = await call(repo);
  eq(listed.items.map((i: any) => i.name), ["Oats", "Apples", "Milk"]);
  const added: any = await call(repo, OWNER, { operation: "add_item", arguments: { name: "Eggs", quantity: 6 } });
  eq(added.ok, true); eq(added.item.name, "Eggs");
  const again: any = await call(repo);
  eq(again.items.map((i: any) => i.name), ["Oats", "Apples", "Milk", "Eggs"]);
});

Deno.test("list_apps and get_pack shapes", async () => {
  const repo = new FakeRepo();
  const apps: any = await handleListApps(repo, OWNER);
  eq(apps.apps.length, 1); eq(apps.apps[0].app_id, "grocery-list"); eq(apps.apps[0].version, 1);
  assert(!("instructions" in apps.apps[0]) && !("operations" in apps.apps[0]));
  const empty: any = await handleListApps(repo, NONMEMBER);
  eq(empty.apps, []);
  for (const id of ["build", "run", "grocery-list"]) {
    const got: any = await handleGetPack(repo, OWNER, id);
    eq(got.ok, true, id); eq(got.pack.pack_id, id); assert(typeof got.pack.instructions === "string");
    if (id === "grocery-list") {
      assert(Array.isArray(got.operations));
      assert(got.operations.every((o: any) => !("effect" in o)), "effect must be stripped");
    } else assert(!("operations" in got), "non-app pack must not carry operations");
  }
  eq((await handleGetPack(repo, OWNER, "nope") as any).error_code, "unknown_pack");
  eq((await handleGetPack(repo, NONMEMBER, "grocery-list") as any).error_code, "not_member");
  eq((await handleGetPack(repo, NONMEMBER, "build") as any).ok, true);
});

Deno.test("invalid arguments mutate nothing", async () => {
  const cases: any[] = [
    { name: "", quantity: 1 }, { name: "   ", quantity: 1 }, { quantity: 1 }, { name: 5, quantity: 1 },
    { name: "X", quantity: 0 }, { name: "X", quantity: -3 }, { name: "X", quantity: 1.5 },
    { name: "X", quantity: "2" }, { name: "X", quantity: true }, { name: "X", quantity: null },
    { name: "X" }, { name: "X", quantity: 1, extra: 1 },
  ];
  for (const args of cases) {
    const repo = new FakeRepo();
    const res: any = await call(repo, OWNER, { operation: "add_item", arguments: args });
    eq(res.ok, false, JSON.stringify(args)); eq(res.error_code, "invalid_arguments", JSON.stringify(args));
    assert(typeof res.guidance === "string" && res.guidance.length > 0);
    eq(repo.mutations, 0, JSON.stringify(args)); eq(repo.items.length, 3);
  }
  const repo = new FakeRepo();
  eq((await call(repo, OWNER, { operation: "add_item", arguments: { name: "X", quantity: 1 }, environment: "staging" }) as any).error_code, "invalid_arguments");
  eq(repo.mutations, 0);
  const okRepo = new FakeRepo();
  const ok: any = await call(okRepo, OWNER, { operation: "add_item", arguments: { name: "  Eggs  ", quantity: 1 } });
  eq(ok.item.name, "Eggs");
  for (const v of [undefined, 1.5, "1"]) {
    const r = new FakeRepo();
    eq((await call(r, OWNER, { app_version: v }) as any).error_code, "invalid_arguments");
  }
});

Deno.test("stale version exact payload, precedence, taxonomy", async () => {
  const repo = new FakeRepo(); repo.app.current_version = 2; repo.definitions.set("grocery-list:2", v1Definition());
  for (const op of ["list_items", "add_item"]) {
    const res: any = await call(repo, OWNER, { operation: op, app_version: 1, arguments: { name: "X", quantity: 1 } });
    eq(res, { ok: false, error_code: "stale_version", current_version: 2, guidance: "Call get_pack for this app, then retry once with the current app_version." });
  }
  eq(repo.mutations, 0);
  // precedence
  eq((await call(repo, OWNER, { app_id: "nope", app_version: 1 }) as any).error_code, "unknown_app");
  eq((await call(repo, NONMEMBER, { app_version: 1, operation: "bogus" }) as any).error_code, "not_member");
  eq((await call(repo, OWNER, { app_version: 1, operation: "bogus" }) as any).error_code, "stale_version");
  const fresh = new FakeRepo();
  eq((await call(fresh, OWNER, { operation: "bogus", arguments: { bad: 1 } }) as any).error_code, "unknown_operation");
  const noDef = new FakeRepo(); noDef.definitions.clear();
  eq((await call(noDef) as any).error_code, "invalid_definition");
  const badRes = new FakeRepo(); const d = v1Definition(); const eff0 = d.operations[0].effect; assert(eff0); eff0.resource = "poc_apps"; badRes.definitions.set("grocery-list:1", d);
  eq((await call(badRes) as any).error_code, "invalid_definition"); eq(badRes.itemQueries, 0);
  const badAct = new FakeRepo(); const d2 = v1Definition(); const eff1 = d2.operations[0].effect; assert(eff1); eff1.action = "update"; badAct.definitions.set("grocery-list:1", d2);
  eq((await call(badAct) as any).error_code, "invalid_definition"); eq(badAct.itemQueries, 0);
});

Deno.test("call_operation executes a DB-added remove_item operation with no server change", async () => {
  const repo = new FakeRepo();
  eq((await call(repo, OWNER, { operation: "remove_item", arguments: { name: "Milk" } }) as any).error_code, "unknown_operation");
  const v2 = v1Definition();
  v2.operations.push({ name: "remove_item", kind: "write", description: "Remove by name.", arguments: [{ name: "name", type: "string", required: true, min_length: 1, trim: true }], effect: { action: "delete", resource: "grocery_items", match: ["name"] } });
  repo.definitions.set("grocery-list:2", v2); repo.app.current_version = 2;
  const removed: any = await call(repo, OWNER, { operation: "remove_item", app_version: 2, arguments: { name: "Milk" } });
  eq(removed.ok, true); eq(removed.removed.map((i: any) => i.name), ["Milk"]);
  eq(repo.items.map((i) => i.name), ["Oats", "Apples"]);
  const missing: any = await call(repo, OWNER, { operation: "remove_item", app_version: 2, arguments: { name: "Nope" } });
  eq(missing.error_code, "item_not_found");
  const pack: any = await handleGetPack(repo, OWNER, "grocery-list");
  assert(pack.operations.some((o: any) => o.name === "remove_item"));
});

Deno.test("G1.7 sequence: stale v1 call mutates nothing, get_pack + v2 retry writes exactly once", async () => {
  // Simulate applying the version-2 fixture update artifact to a v1 fixture:
  // a version-2 definition adding remove_item, and the app bumped to version 2.
  const repo = new FakeRepo();
  const v2 = v1Definition();
  v2.operations.push({ name: "remove_item", kind: "write", description: "Remove by name.", arguments: [{ name: "name", type: "string", required: true, min_length: 1, trim: true }], effect: { action: "delete", resource: "grocery_items", match: ["name"] } });
  repo.definitions.set("grocery-list:2", v2);
  repo.app.current_version = 2;
  // A call still carrying version 1 is rejected stale_version before mutation.
  const stale: any = await call(repo, OWNER, { operation: "remove_item", app_version: 1, arguments: { name: "Milk" } });
  eq(stale, { ok: false, error_code: "stale_version", current_version: 2, guidance: "Call get_pack for this app, then retry once with the current app_version." });
  eq(repo.mutations, 0);
  eq(repo.items.map((i) => i.name), ["Oats", "Apples", "Milk"]);
  // The companion reloads the pack, sees remove_item at version 2, and retries once.
  const pack: any = await handleGetPack(repo, OWNER, "grocery-list");
  eq(pack.pack.version, 2);
  assert(pack.operations.some((o: any) => o.name === "remove_item"));
  const retried: any = await call(repo, OWNER, { operation: "remove_item", app_version: 2, arguments: { name: "Milk" } });
  eq(retried.ok, true);
  eq(retried.removed.map((i: any) => i.name), ["Milk"]);
  eq(repo.mutations, 1, "exactly one write across the stale call and the retry");
  eq(repo.items.map((i) => i.name), ["Oats", "Apples"]);
});

Deno.test("list effect order direction is honored and effect fields must be required", async () => {
  const repo = new FakeRepo();
  const descDef = v1Definition();
  descDef.operations.push({ name: "list_items_desc", kind: "read", description: "list desc", arguments: [], effect: { action: "list", resource: "grocery_items", order: [{ field: "id", direction: "desc" }] } });
  repo.definitions.set("grocery-list:1", descDef);
  const desc: any = await call(repo, OWNER, { operation: "list_items_desc" });
  eq(desc.items.map((i: any) => i.name), ["Milk", "Apples", "Oats"]);
  const optRepo = new FakeRepo();
  const optDef = v1Definition();
  optDef.operations.push({ name: "remove_item", kind: "write", description: "remove", arguments: [{ name: "name", type: "string", required: false, min_length: 1, trim: true }], effect: { action: "delete", resource: "grocery_items", match: ["name"] } });
  optRepo.definitions.set("grocery-list:1", optDef);
  eq((await call(optRepo, OWNER, { operation: "remove_item", arguments: { name: "Milk" } }) as any).error_code, "invalid_definition");
  eq(optRepo.itemQueries, 0); eq(optRepo.mutations, 0);
});

Deno.test("membership enforcement and log shaping", async () => {
  const repo = new FakeRepo();
  eq((await call(repo, NONMEMBER) as any).error_code, "not_member");
  eq((await call(repo, NONMEMBER, { operation: "add_item", arguments: { name: "X", quantity: 1 } }) as any).error_code, "not_member");
  eq(repo.mutations, 0);
  assert(repo.logs.length >= 2);
  assert(repo.logs.every((l) => l.outcome === "rejected" && l.error_code === "not_member"));
  const okRepo = new FakeRepo();
  await call(okRepo); await handleListApps(okRepo, OWNER); await handleGetPack(okRepo, OWNER, "build");
  const okLog = okRepo.logs.find((l) => l.operation === "list_items");
  assert(okLog);
  eq(okLog.outcome, "ok"); eq(okLog.app_id, "grocery-list"); eq(okLog.app_version, 1); eq(okLog.environment, "production");
  const laLog = okRepo.logs.find((l) => l.operation === "list_apps");
  assert(laLog);
  eq(laLog.app_id, null); eq(laLog.app_version, null); eq(laLog.environment, null);
  const gpLog = okRepo.logs.find((l) => l.operation === "get_pack");
  assert(gpLog);
  eq(gpLog.app_id, null);
  for (const row of okRepo.logs) {
    const keys = Object.keys(row).join(",");
    assert(!/token|authorization|header|arguments/i.test(keys), `log row leaks field: ${keys}`);
  }
  // log failure leaves payload unchanged
  const failRepo = new FakeRepo(); failRepo.failLog = true;
  const res: any = await call(failRepo);
  eq(res.ok, true); eq(res.items.length, 3);
  // shapeLogRow + unauthenticated shaping
  eq(shapeLogRow({ account_id: null, app_id: null, operation: "list_apps", app_version: null, environment: null, outcome: "ok", error_code: null }).operation, "list_apps");
  const extracted = extractLogFieldsFromToolCall(JSON.stringify({ jsonrpc: "2.0", method: "tools/call", params: { name: "call_operation", arguments: { app_id: "grocery-list", operation: "add_item", app_version: 1, arguments: { name: "SECRETARG" } } } }));
  assert(extracted); eq(extracted.operation, "add_item");
  assert(!JSON.stringify(extracted).includes("SECRETARG"));
  const unauth = unauthenticatedLogRow(extracted);
  eq(unauth.account_id, null); eq(unauth.outcome, "rejected"); eq(unauth.error_code, "unauthenticated");
  eq(extractLogFieldsFromToolCall(JSON.stringify({ method: "initialize", params: {} })), null);
});
