import { scoreConflict } from "../src/core/semantics.js";

function test(action, lock, expectSafe, label) {
  const r = scoreConflict({ actionText: action, lockText: lock });
  const isSafe = !r.isConflict;
  const pass = isSafe === expectSafe;
  console.log(`${pass ? "PASS" : "FAIL"} | ${label}: ${r.confidence}% ${r.level} ${r.isConflict ? "CONFLICT" : "SAFE"}`);
  if (!pass) console.log(`       Expected: ${expectSafe ? "SAFE" : "CONFLICT"}`);
}

// G2.1: Update Stripe UI vs API key lock → SAFE (different subjects)
test(
  "Update the Stripe payment UI components to match new branding",
  "Stripe API keys must never be exposed in client-side code",
  true, "G2.1: Update Stripe UI vs API key lock"
);

// G2.3: Optimize Supabase queries vs optimization lock → SAFE (mandate compliance)
test(
  "Optimize the Supabase database queries for faster load times",
  "All Supabase queries must be optimized for performance at all times",
  true, "G2.3: Optimize Supabase queries"
);

// Regression check: Modify Stripe billing vs billing lock → CONFLICT
test(
  "Update Stripe subscription handling to support annual billing",
  "Never modify the billing integration with Stripe — any change risks double-charging",
  false, "Regression: Modify Stripe billing"
);

// G1.1: Add publishable key to frontend → CONFLICT
test(
  "Add the Stripe publishable key to the React checkout component",
  "Stripe API keys must never be exposed in client-side code",
  false, "G1.1: Add publishable key"
);

// G1.2: Store STRIPE_SECRET_KEY in frontend → CONFLICT
test(
  "Store the STRIPE_SECRET_KEY in the frontend environment config",
  "Stripe API keys must never be exposed in client-side code",
  false, "G1.2: Store SECRET_KEY in frontend"
);

// Also check: Modify Stripe integration → CONFLICT
test(
  "Update the Stripe webhook handler to use the new API version",
  "Don't modify the Stripe integration — PCI compliance depends on it",
  false, "Rajesh: Modify Stripe integration"
);
