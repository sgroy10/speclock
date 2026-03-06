import { analyzeConflict } from '../src/core/semantics.js';

// Claude's actual lock text (preservation style, not prohibition style)
const stripeLock = 'Payment processing must always use Stripe';

const tests = [
  // Suite B1 — Indian payment gateways
  ['Add Razorpay as payment option for Indian customers', stripeLock, true],
  ['Add Cashfree payment gateway', stripeLock, true],
  ['Add CCAvenue as payment gateway', stripeLock, true],
  ['Add PhonePe as payment option', stripeLock, true],
  ['Add Paytm payment gateway', stripeLock, true],
  ['Add Razorpay for UPI payments', stripeLock, true],
  ['Use Google Pay as checkout option', stripeLock, true],
  ['Integrate Razorpay for Indian market', stripeLock, true],
  // Suite A — False positives
  ['Test that Stripe payments are working correctly', stripeLock, false],
  ['Debug and fix the Stripe webhook handler', stripeLock, false],
  // Also test with prohibition lock for comparison
  ['Add Razorpay as payment option for Indian customers', 'Never change the Stripe integration', true],
  ['Add Razorpay as payment option for Indian customers', 'Never change the payment provider from Stripe', true],
];

let pass = 0, fail = 0;
for (const [action, lock, expected] of tests) {
  const r = analyzeConflict(action, lock);
  const ok = r.isConflict === expected;
  const label = ok ? 'PASS' : 'FAIL';
  const detail = r.isConflict ? `${r.confidence}% ${r.level}` : `safe (${r.confidence}%)`;
  console.log(`${label} | ${action.substring(0, 55).padEnd(55)} | ${detail}`);
  if (!ok) {
    console.log(`  Expected: ${expected}, Got: ${r.isConflict}`);
    console.log(`  Lock: ${lock.substring(0, 60)}`);
    console.log(`  Reasons: ${r.reasons.join(' | ')}`);
    fail++;
  } else {
    pass++;
  }
}
console.log(`\n========================================`);
console.log(`  CLAUDE TEST DEBUG: ${pass}/${pass + fail} passed, ${fail} failed`);
console.log(`========================================`);
