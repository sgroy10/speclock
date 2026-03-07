/**
 * Live Railway API tests for G-suite fixes (v4.5.4)
 * Tests G1 (API key terminology), G2 (scope precision), G3 (compound actions)
 */

const API = "https://speclock-mcp-production.up.railway.app";

async function mcpCall(method, args) {
  const res = await fetch(`${API}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "tools/call",
      params: { name: method, arguments: args }
    })
  });
  const raw = await res.text();
  // Parse SSE format: "event: message\ndata: {...}"
  const dataLine = raw.split("\n").find(l => l.startsWith("data: "));
  if (!dataLine) return { text: raw };
  const json = JSON.parse(dataLine.replace("data: ", ""));
  return { text: json?.result?.content?.[0]?.text || "", raw: json };
}

async function main() {
  console.log("=== Railway Live G-Suite Tests (v4.5.4) ===\n");

  // Health check
  const health = await (await fetch(`${API}/health`)).json();
  console.log(`Railway: v${health.version}, status: ${health.status}\n`);

  // Add test locks
  const testLocks = [
    "The app must always use Stripe for payment processing",
    "All Supabase queries must be optimized for performance at all times",
    "WhatsApp integration must always use the Baileys library",
    "Stripe API keys must never be exposed in client-side code",
    "The app must always use Supabase Auth for user authentication",
  ];

  const lockIds = [];
  console.log("Adding test locks...");
  for (const lock of testLocks) {
    const { text } = await mcpCall("speclock_add_lock", { text: lock, source: "user" });
    const idMatch = text.match(/LOCK-\w+/);
    lockIds.push(idMatch ? idMatch[0] : null);
    console.log(`  ${idMatch ? idMatch[0] : "?"}: ${lock.substring(0, 60)}`);
  }
  console.log("");

  let passed = 0;
  let total = 0;

  async function test(action, expectConflict, label) {
    total++;
    const { text } = await mcpCall("speclock_check_conflict", { proposedAction: action });
    const isConflict = /conflict/i.test(text) && !/no conflict/i.test(text);
    const pass = isConflict === expectConflict;
    const tag = pass ? "PASS" : "FAIL";
    const exp = expectConflict ? "CONFLICT" : "SAFE";
    console.log(`${tag} | ${label} (expected ${exp})`);
    if (!pass) {
      console.log(`       Response: ${text.substring(0, 300)}`);
    }
    if (pass) passed++;
  }

  // G2: Scope Precision (expect SAFE)
  console.log("--- G2: Scope Precision (expect SAFE) ---");
  await test("Update the Stripe payment UI components to match new branding", false, "G2.1: Update Stripe UI");
  await test("Write tests for the Supabase authentication module", false, "G2.2: Write tests for Supabase");
  await test("Optimize the Supabase database queries for faster load times", false, "G2.3: Optimize Supabase queries");
  await test("Update the WhatsApp message formatting in the Baileys handler", false, "G2.4: Update WhatsApp formatting");

  // G1: API Key Terminology (expect CONFLICT)
  console.log("\n--- G1: API Key Terminology (expect CONFLICT) ---");
  await test("Add the Stripe publishable key to the React checkout component", true, "G1.1: Publishable key in frontend");
  await test("Store the STRIPE_SECRET_KEY in the frontend environment config", true, "G1.2: STRIPE_SECRET_KEY in frontend");

  // G3: Compound Action (expect CONFLICT)
  console.log("\n--- G3: Compound Action (expect CONFLICT) ---");
  await test("Implement Auth0 JWT verification and store session secrets in localStorage", true, "G3.1: Auth0 + localStorage secrets");

  console.log(`\n=== Results: ${passed}/${total} passed ===`);

  // Cleanup
  console.log("\nCleaning up test locks...");
  for (const id of lockIds) {
    if (id) {
      await mcpCall("speclock_remove_lock", { lockId: id });
      console.log(`  Removed: ${id}`);
    }
  }
}

main().catch(console.error);
