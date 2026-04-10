/**
 * Smoke test for FIX 1: warn mode is default, strict opts in.
 * We invoke the CLI as a child process so we exercise the real code path.
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "src", "cli", "index.js");

// Create a tiny test project with a lock and a staged violating file.
const testProject = path.join(repoRoot, ".test-warn");
fs.rmSync(testProject, { recursive: true, force: true });
fs.mkdirSync(testProject, { recursive: true });

function run(args, env = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: testProject,
    env: { ...process.env, ...env },
    encoding: "utf-8",
  });
}

// Init + git init
spawnSync("git", ["init", "-q"], { cwd: testProject });
spawnSync("git", ["config", "user.email", "t@t.t"], { cwd: testProject });
spawnSync("git", ["config", "user.name", "t"], { cwd: testProject });

let failed = 0;
function check(label, cond, detail) {
  if (cond) {
    console.log(`  [OK] ${label}`);
  } else {
    console.error(`  [FAIL] ${label}: ${detail}`);
    failed++;
  }
}

// 1. Fresh project, no locks — audit exits 0
{
  const r = run(["audit"]);
  check("audit exit 0 when no locks", r.status === 0, `status=${r.status}`);
}

// 2. Init + add a lock + create a matching "violation" file
run(["init"]);
run(["lock", "Never modify auth files"]);

const authFile = path.join(testProject, "auth.js");
fs.writeFileSync(authFile, "console.log('auth');\n");
spawnSync("git", ["add", "auth.js"], { cwd: testProject });

// 3. Default audit should warn but exit 0
{
  const r = run(["audit"]);
  const out = (r.stdout || "") + (r.stderr || "");
  check(
    "audit with violation exits 0 in warn mode",
    r.status === 0,
    `status=${r.status} out=${out.slice(0, 200)}`
  );
  check(
    "audit warn mode prints 'Warning mode active'",
    out.includes("Warning mode active"),
    `out did not contain warning text: ${out.slice(0, 300)}`
  );
  check(
    "audit warn mode prints 'SPECLOCK WARNINGS' header",
    out.includes("SPECLOCK WARNINGS"),
    `header missing: ${out.slice(0, 300)}`
  );
}

// 4. --strict should exit 1
{
  const r = run(["audit", "--strict"]);
  const out = (r.stdout || "") + (r.stderr || "");
  check(
    "audit --strict with violation exits 1",
    r.status === 1,
    `status=${r.status} out=${out.slice(0, 300)}`
  );
  check(
    "audit --strict prints 'SPECLOCK AUDIT FAILED'",
    out.includes("SPECLOCK AUDIT FAILED"),
    `failed header missing`
  );
}

// 5. SPECLOCK_STRICT=1 should exit 1
{
  const r = run(["audit"], { SPECLOCK_STRICT: "1" });
  check(
    "audit with SPECLOCK_STRICT=1 exits 1",
    r.status === 1,
    `status=${r.status}`
  );
}

// 6. After `speclock enforce hard`, audit without flag exits 1
{
  run(["enforce", "hard"]);
  const r = run(["audit"]);
  check(
    "audit exits 1 after enforce hard (persistent)",
    r.status === 1,
    `status=${r.status}`
  );
  // Revert
  run(["enforce", "advisory"]);
}

// Cleanup
fs.rmSync(testProject, { recursive: true, force: true });

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll warn-mode checks passed");
