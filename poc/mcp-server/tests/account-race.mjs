// Developer-run local race check (testing plan test 8). Not part of node --test
// gates: requires the throwaway Docker container `loomspan-poc-pg` from the
// fixture proof. Refuses to run if the container is absent; never accepts a
// hosted URL or connection string. Prints only pass/fail and counts.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);

async function psql(sql) {
  const { stdout } = await run('docker', ['exec', '-i', 'loomspan-poc-pg', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', sql]);
  return stdout.trim();
}

try {
  await run('docker', ['inspect', 'loomspan-poc-pg']);
} catch {
  console.error('FAIL account-race: container loomspan-poc-pg not found; run the local fixture proof first.');
  process.exit(1);
}

const statement = "INSERT INTO poc_accounts (normalized_email) VALUES ('race@example.invalid') ON CONFLICT (normalized_email) DO UPDATE SET normalized_email = EXCLUDED.normalized_email RETURNING id";
await psql("DELETE FROM poc_accounts WHERE normalized_email = 'race@example.invalid'");
const ids = await Promise.all(Array.from({ length: 16 }, () => psql(statement)));
const unique = new Set(ids);
const count = await psql("SELECT count(*) FROM poc_accounts WHERE normalized_email = 'race@example.invalid'");
await psql("DELETE FROM poc_accounts WHERE normalized_email = 'race@example.invalid'");
if (unique.size !== 1 || count !== '1') {
  console.error(`FAIL account-race: unique_ids=${unique.size} rows=${count}`);
  process.exit(1);
}
console.log('PASS account-race: 16 parallel resolutions, unique_ids=1 rows=1');
