import { scoreConflict } from '../src/core/semantics.js';

const preservationLock = 'Payment processing must always use Stripe and no other payment provider';
const whatsappLock = 'WhatsApp bot uses Baileys library — do not replace or remove Baileys';
const dbLock = 'Database must always be PostgreSQL - never switch to another database';
const supabaseLock = 'Auth handled by Supabase Auth only — do not switch auth providers';
const apiKeyLock = 'Never expose API keys in frontend code';

console.log('=== G2: SCOPE PRECISION (should be SAFE) ===');
const g2tests = [
  ['Update the Stripe UI components for better UX', preservationLock],
  ['Write tests for the Supabase database queries', dbLock],
  ['Optimize Supabase queries for better performance', dbLock],
  ['Update the WhatsApp message formatting logic', whatsappLock],
];
for (const [action, lock] of g2tests) {
  const r = scoreConflict({ actionText: action, lockText: lock });
  const status = r.isConflict ? 'FAIL (FP)' : 'PASS     ';
  console.log(status, '|', action.substring(0,55).padEnd(55), '|', r.confidence + '%', r.level);
  if (r.isConflict) console.log('  Reasons:', r.reasons);
}

console.log('');
console.log('=== G1: API KEY TERMINOLOGY (should be BLOCKED) ===');
const g1tests = [
  ['Add Stripe publishable key inside the checkout component', apiKeyLock],
  ['Add the STRIPE_SECRET_KEY to the React state', apiKeyLock],
  ['Embed the Stripe public key in the frontend config', apiKeyLock],
  ['Use process.env.STRIPE_KEY directly in the UI component', apiKeyLock],
];
for (const [action, lock] of g1tests) {
  const r = scoreConflict({ actionText: action, lockText: lock });
  const status = r.isConflict ? 'PASS     ' : 'FAIL (FN)';
  console.log(status, '|', action.substring(0,55).padEnd(55), '|', r.confidence + '%', r.level);
  if (!r.isConflict) console.log('  Reasons:', r.reasons);
}

console.log('');
console.log('=== G3: MULTI-LOCK (should be BLOCKED by at least one) ===');
const g3action = 'Implement Auth0 JWT and store secrets in localStorage';
const r1 = scoreConflict({ actionText: g3action, lockText: supabaseLock });
const r2 = scoreConflict({ actionText: g3action, lockText: apiKeyLock });
console.log('vs auth lock:', r1.isConflict ? 'BLOCKED' : 'MISSED ', r1.confidence + '%', r1.reasons);
console.log('vs apikey lock:', r2.isConflict ? 'BLOCKED' : 'MISSED ', r2.confidence + '%', r2.reasons);
