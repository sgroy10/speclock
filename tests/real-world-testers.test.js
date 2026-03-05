// ===================================================================
// REAL-WORLD TESTERS SIMULATION
// ===================================================================
// Simulates 5 independent testers using SpecLock in different domains
// with natural language locks and actions — exactly like external testers.
//
// Each tester:
// 1. Creates locks in their natural language (messy, real-world phrasing)
// 2. Performs actions that SHOULD be caught (true positives)
// 3. Performs actions that should NOT be caught (true negatives)
//
// Target: 100% detection, 0% false positives across ALL testers.
//
// Run: node tests/real-world-testers.test.js
// ===================================================================

import fs from "fs";
import path from "path";
import os from "os";
import {
  ensureSpeclockDirs,
  makeBrain,
  writeBrain,
  readBrain,
} from "../src/core/storage.js";
import {
  ensureInit,
  setGoal,
  addLock,
  addDecision,
  checkConflict,
} from "../src/core/engine.js";

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label, detail) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.log(`  FAIL: ${label}${detail ? " — " + detail : ""}`);
    failures.push(label);
  }
}

function makeRoot(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `speclock-${name}-`));
  ensureInit(root);
  return root;
}

function expectConflict(root, action, label) {
  const r = checkConflict(root, action);
  assert(r.hasConflict === true, `TP: ${label}`,
    r.hasConflict ? undefined : `scored ${r.conflictingLocks[0]?.confidence || 0}% — expected conflict`);
}

function expectSafe(root, action, label) {
  const r = checkConflict(root, action);
  assert(r.hasConflict === false, `TN: ${label}`,
    r.hasConflict ? `scored ${r.conflictingLocks[0]?.confidence}% on "${r.conflictingLocks[0]?.text?.substring(0, 50)}"` : undefined);
}

// ===================================================================
// TESTER 1: PRIYA — WhatsApp Clone on Cursor
// ===================================================================
// Priya is building a WhatsApp clone. She uses casual, natural locks.
// Key challenge: "WhatsApp" appears in many locks but different components.
// ===================================================================
console.log("\n=== TESTER 1: PRIYA — WhatsApp Clone ===");
{
  const ROOT = makeRoot("priya");
  setGoal(ROOT, "Build a WhatsApp clone with end-to-end encryption");

  // Natural language locks — exactly how a real user would phrase them
  addLock(ROOT, "Never touch the message encryption system, it's working perfectly", [], "user");
  addLock(ROOT, "Don't change the real-time socket connection handler, it took weeks to get right", [], "user");
  addLock(ROOT, "The read receipt system must not be modified — users love it", [], "user");
  addLock(ROOT, "Never remove the group chat admin permissions feature", [], "user");
  addLock(ROOT, "Don't mess with the media compression pipeline, it's optimized for mobile", [], "user");

  // TRUE POSITIVES — actions that should trigger conflicts
  expectConflict(ROOT, "Let's rewrite the encryption module to use a simpler algorithm", "Rewrite encryption");
  expectConflict(ROOT, "I want to replace the socket handler with HTTP polling instead", "Replace socket handler");
  expectConflict(ROOT, "Remove the read receipt checkmarks, users find them annoying", "Remove read receipts");
  expectConflict(ROOT, "Delete the admin roles from group chats to simplify the code", "Delete group admin perms");
  expectConflict(ROOT, "Streamline the media pipeline by removing the compression step", "Remove media compression");
  expectConflict(ROOT, "Disable the end-to-end encryption temporarily for debugging", "Disable encryption");
  expectConflict(ROOT, "Swap out the WebSocket library for a different one", "Swap socket library");
  expectConflict(ROOT, "Sunset the group admin features since nobody uses them", "Sunset group admin");
  expectConflict(ROOT, "Optimize the compression by replacing it with server-side processing", "Replace compression pipeline");

  // TRUE NEGATIVES — different components, should NOT trigger
  expectSafe(ROOT, "Add emoji reactions to messages", "Emoji reactions");
  expectSafe(ROOT, "Build a new status/stories feature like Instagram", "Status stories");
  expectSafe(ROOT, "Create a contact search with fuzzy matching", "Contact search");
  expectSafe(ROOT, "Add voice message recording with noise cancellation", "Voice messages");
  expectSafe(ROOT, "Implement message forwarding across chats", "Message forwarding");
  expectSafe(ROOT, "Build a chat wallpaper customization screen", "Chat wallpaper");
  expectSafe(ROOT, "Add push notification settings page", "Notification settings");
  expectSafe(ROOT, "Create archived chats section", "Archived chats");
  expectSafe(ROOT, "Build typing indicator animation", "Typing indicator");
  expectSafe(ROOT, "Add phone number verification during signup", "Phone verification");
}

// ===================================================================
// TESTER 2: MARCUS — Fintech Trading Platform on Claude Code
// ===================================================================
// Marcus builds a trading platform. His locks use financial jargon.
// Key challenge: Financial terms like "order", "balance", "position"
// are shared across many unrelated contexts.
// ===================================================================
console.log("\n=== TESTER 2: MARCUS — Fintech Trading Platform ===");
{
  const ROOT = makeRoot("marcus");
  setGoal(ROOT, "Build a real-time stock trading platform with compliance");

  addLock(ROOT, "The trade execution engine must never be modified without code review", [], "user");
  addLock(ROOT, "Never allow direct database writes to the ledger — all entries go through the reconciliation service", [], "user");
  addLock(ROOT, "Don't touch the KYC verification flow, it's SEC-compliant", [], "user");
  addLock(ROOT, "The real-time price feed WebSocket must not be interrupted or reconfigured", [], "user");
  addLock(ROOT, "Never expose internal portfolio positions through the public API", [], "user");
  addLock(ROOT, "Don't change the order matching algorithm — it's been audited", [], "user");

  // TRUE POSITIVES
  expectConflict(ROOT, "Refactor the trade execution logic to support batch orders", "Modify trade execution");
  expectConflict(ROOT, "Write directly to the ledger table to fix a balance discrepancy", "Direct ledger write");
  expectConflict(ROOT, "Update the KYC form to remove the social security number field", "Modify KYC flow");
  expectConflict(ROOT, "Reconfigure the price feed to use REST polling instead of WebSocket", "Reconfigure price feed");
  expectConflict(ROOT, "Add a public endpoint that shows user portfolio allocations", "Expose portfolio data");
  expectConflict(ROOT, "Tweak the order matching to prioritize limit orders over market orders", "Modify order matching");
  expectConflict(ROOT, "Bypass the reconciliation service for faster settlement", "Bypass reconciliation");
  expectConflict(ROOT, "Temporarily disable KYC checks for the beta program", "Disable KYC");

  // TRUE NEGATIVES
  expectSafe(ROOT, "Build a stock watchlist feature with price alerts", "Stock watchlist");
  expectSafe(ROOT, "Add a portfolio performance chart with historical data", "Performance chart");
  expectSafe(ROOT, "Create a news feed aggregator for market updates", "News feed");
  expectSafe(ROOT, "Build an account settings page with notification preferences", "Account settings");
  expectSafe(ROOT, "Add two-factor authentication for login", "Add 2FA login");
  expectSafe(ROOT, "Create a paper trading simulator for new users", "Paper trading sim");
  expectSafe(ROOT, "Build a dividend calendar view", "Dividend calendar");
  expectSafe(ROOT, "Add dark mode theme to the trading interface", "Dark mode");
  expectSafe(ROOT, "Implement PDF export for tax statements", "Tax statement export");
  expectSafe(ROOT, "Build a customer support chat widget", "Support chat");
}

// ===================================================================
// TESTER 3: SARAH — E-commerce Shopify App on Windsurf
// ===================================================================
// Sarah builds a Shopify app. She uses non-technical language.
// Key challenge: Vague locks like "don't break the checkout"
// and actions that sound similar but target different features.
// ===================================================================
console.log("\n=== TESTER 3: SARAH — E-commerce Shopify App ===");
{
  const ROOT = makeRoot("sarah");
  setGoal(ROOT, "Build a premium Shopify app for product customization");

  addLock(ROOT, "The checkout flow must not be changed — it's been A/B tested and converts at 4.2%", [], "user");
  addLock(ROOT, "Never delete customer reviews, they're legally required for FTC compliance", [], "user");
  addLock(ROOT, "Don't modify the Stripe integration — PCI compliance depends on it", [], "user");
  addLock(ROOT, "The product image CDN configuration is frozen — any change breaks mobile", [], "user");
  addLock(ROOT, "Never remove the abandoned cart email recovery system — it generates 30% of revenue", [], "user");
  addLock(ROOT, "Don't touch the SEO meta tag generation — organic traffic depends on it", [], "user");

  // TRUE POSITIVES
  expectConflict(ROOT, "Redesign the checkout page with a new layout", "Redesign checkout");
  expectConflict(ROOT, "Clean up old reviews that have less than 3 stars", "Delete bad reviews");
  expectConflict(ROOT, "Update the Stripe webhook handler to use the new API version", "Modify Stripe integration");
  expectConflict(ROOT, "Switch the CDN provider from CloudFront to Cloudflare for images", "Change image CDN");
  expectConflict(ROOT, "Replace the cart recovery emails with push notifications instead", "Replace cart recovery");
  expectConflict(ROOT, "Overhaul the meta tag structure for better social sharing", "Modify SEO meta tags");
  expectConflict(ROOT, "Simplify checkout by removing the guest checkout option", "Simplify checkout");
  expectConflict(ROOT, "Archive reviews older than 2 years to save database space", "Archive old reviews");

  // TRUE NEGATIVES
  expectSafe(ROOT, "Add a product size guide popup", "Size guide");
  expectSafe(ROOT, "Build a wishlist feature for logged-in users", "Wishlist");
  expectSafe(ROOT, "Create a loyalty points rewards program", "Loyalty program");
  expectSafe(ROOT, "Add a product comparison table", "Product comparison");
  expectSafe(ROOT, "Build a gift card purchasing system", "Gift cards");
  expectSafe(ROOT, "Implement a store locator with Google Maps", "Store locator");
  expectSafe(ROOT, "Add a recently viewed products section", "Recently viewed");
  expectSafe(ROOT, "Create a flash sale countdown timer", "Flash sale timer");
  expectSafe(ROOT, "Build customer referral tracking", "Referral tracking");
  expectSafe(ROOT, "Add Instagram feed integration to product pages", "Instagram feed");
}

// ===================================================================
// TESTER 4: AMIR — IoT Smart Home Platform on Codex
// ===================================================================
// Amir builds IoT firmware and cloud platform. His locks are technical.
// Key challenge: Hardware terms, firmware concepts, and device
// management operations that overlap in vocabulary.
// ===================================================================
console.log("\n=== TESTER 4: AMIR — IoT Smart Home Platform ===");
{
  const ROOT = makeRoot("amir");
  setGoal(ROOT, "Build a smart home IoT platform with OTA firmware updates");

  addLock(ROOT, "The firmware signing process must never be bypassed — all updates must be cryptographically signed", [], "user");
  addLock(ROOT, "Don't modify the MQTT broker configuration — 50k devices depend on it", [], "user");
  addLock(ROOT, "Never expose device API keys in the mobile app bundle", [], "user");
  addLock(ROOT, "The sensor data retention policy is 90 days — don't change it without legal approval", [], "user");
  addLock(ROOT, "Never allow unsigned firmware to be pushed to production devices", [], "user");

  // TRUE POSITIVES
  expectConflict(ROOT, "Skip the code signing step to speed up firmware deploys", "Skip firmware signing");
  expectConflict(ROOT, "Reconfigure the MQTT broker to use a different port", "Reconfigure MQTT");
  expectConflict(ROOT, "Embed API keys in the React Native app for faster development", "Expose API keys in app");
  expectConflict(ROOT, "Extend sensor data retention to 180 days", "Change retention policy");
  expectConflict(ROOT, "Push the debug firmware build to production devices for testing", "Push unsigned firmware");
  expectConflict(ROOT, "Disable firmware verification to allow third-party updates", "Disable firmware verification");
  expectConflict(ROOT, "Change the MQTT topic structure to support new device types", "Modify MQTT config");

  // TRUE NEGATIVES
  expectSafe(ROOT, "Build a device dashboard with real-time status", "Device dashboard");
  expectSafe(ROOT, "Add Alexa and Google Home voice control integration", "Voice control");
  expectSafe(ROOT, "Create a scene automation builder (if sunset, turn on lights)", "Scene builder");
  expectSafe(ROOT, "Build a device pairing flow with Bluetooth discovery", "BT pairing flow");
  expectSafe(ROOT, "Add energy consumption tracking and monthly reports", "Energy tracking");
  expectSafe(ROOT, "Create a firmware changelog viewer in the admin panel", "Firmware changelog");
  expectSafe(ROOT, "Build a notification system for device offline alerts", "Device offline alerts");
  expectSafe(ROOT, "Add geofencing for automated home/away modes", "Geofencing");
  expectSafe(ROOT, "Implement a device sharing feature for family members", "Device sharing");
}

// ===================================================================
// TESTER 5: KENJI — SaaS Project Management Tool on Kimi K2
// ===================================================================
// Kenji builds a project management SaaS. His locks are business-focused.
// Key challenge: Business terms that overlap (users, permissions,
// billing, teams) across many features.
// ===================================================================
console.log("\n=== TESTER 5: KENJI — SaaS Project Management ===");
{
  const ROOT = makeRoot("kenji");
  setGoal(ROOT, "Build a Jira alternative with AI-powered task management");

  addLock(ROOT, "The user permission system must not be changed — it's been security audited", [], "user");
  addLock(ROOT, "Never modify the billing integration with Stripe — any change risks double-charging", [], "user");
  addLock(ROOT, "Don't touch the SSO/SAML configuration — enterprise clients depend on it", [], "user");
  addLock(ROOT, "The data export API must remain backward compatible — external integrations rely on it", [], "user");
  addLock(ROOT, "Never delete completed project archives — legal retention requirement", [], "user");

  // TRUE POSITIVES
  expectConflict(ROOT, "Refactor the role-based access control to use a simpler permission model", "Modify permission system");
  expectConflict(ROOT, "Update Stripe subscription handling to support annual billing", "Modify Stripe billing");
  expectConflict(ROOT, "Reconfigure SSO to support OIDC instead of SAML", "Modify SSO config");
  expectConflict(ROOT, "Change the export API response format to use camelCase instead of snake_case", "Break export API compat");
  expectConflict(ROOT, "Clean up old project archives to free up database space", "Delete project archives");
  expectConflict(ROOT, "Simplify permissions by removing the custom role feature", "Remove custom roles");
  expectConflict(ROOT, "Migrate the billing system from Stripe to Paddle", "Replace Stripe billing");

  // TRUE NEGATIVES
  expectSafe(ROOT, "Add a Kanban board view alongside the list view", "Kanban board");
  expectSafe(ROOT, "Build a time tracking feature with weekly summaries", "Time tracking");
  expectSafe(ROOT, "Create a project template library", "Project templates");
  expectSafe(ROOT, "Add Slack and Microsoft Teams notification integration", "Slack integration");
  expectSafe(ROOT, "Build an AI assistant that suggests task priorities", "AI task prioritization");
  expectSafe(ROOT, "Add a Gantt chart visualization for project timelines", "Gantt chart");
  expectSafe(ROOT, "Create a team workload balancing dashboard", "Workload dashboard");
  expectSafe(ROOT, "Build a sprint planning tool with velocity tracking", "Sprint planning");
  expectSafe(ROOT, "Add a document/wiki section for project documentation", "Project wiki");
  expectSafe(ROOT, "Implement a daily standup bot that collects status updates", "Standup bot");
}

// ===================================================================
// CROSS-DOMAIN EDGE CASES
// ===================================================================
// Tests that specifically target the failure patterns found by
// external testers: verb contamination, scope blindness, generic
// word overlap, and euphemism detection across domains.
// ===================================================================
console.log("\n=== EDGE CASES: Cross-Domain Patterns ===");
{
  const ROOT = makeRoot("edge-cases");
  setGoal(ROOT, "Test cross-domain edge cases");

  // Lock with "system" — previously caused false positives with ANY "system" action
  addLock(ROOT, "The authentication system must never be downgraded from OAuth2", [], "user");
  expectConflict(ROOT, "Switch auth from OAuth2 to basic username/password", "Downgrade auth");
  expectSafe(ROOT, "Build a rating and review system for products", "Rating system ≠ auth system");
  expectSafe(ROOT, "Create an inventory management system", "Inventory system ≠ auth system");
  expectSafe(ROOT, "Add a notification system for order updates", "Notification system ≠ auth system");

  // Lock with "data" — previously caused false positives with ANY "data" action
  addLock(ROOT, "Customer payment data must always be encrypted at rest", [], "user");
  expectConflict(ROOT, "Store credit card numbers in plaintext for faster lookups", "Store payment data unencrypted");
  expectConflict(ROOT, "Disable encryption on the payment database for performance", "Disable payment encryption");
  expectSafe(ROOT, "Add a data analytics dashboard for marketing", "Analytics data ≠ payment data");
  expectSafe(ROOT, "Build a data export feature for user profiles", "Profile data ≠ payment data");
  expectSafe(ROOT, "Create a data visualization chart component", "Data viz ≠ payment data");

  // Euphemism detection
  addLock(ROOT, "Never remove the multi-factor authentication requirement", [], "user");
  expectConflict(ROOT, "Phase out the MFA step to improve user onboarding speed", "Euphemism: phase out MFA");
  expectConflict(ROOT, "Sunset the two-factor requirement for internal users", "Euphemism: sunset 2FA");
  expectConflict(ROOT, "Make MFA optional instead of mandatory", "Weaken MFA requirement");
  expectSafe(ROOT, "Add a backup phone number option for MFA recovery", "Add MFA recovery ≠ remove MFA");

  // Temporal evasion
  addLock(ROOT, "The database schema must not be altered without migration scripts", [], "user");
  expectConflict(ROOT, "Temporarily modify the users table to add a debug column", "Temporal evasion: temporarily modify");
  expectConflict(ROOT, "Just for testing, drop the indexes on the orders table", "Temporal evasion: just for testing");
  expectSafe(ROOT, "Write a migration script to add a new preferences column", "Proper migration ≠ direct alter");

  // Context dilution (buried conflict)
  addLock(ROOT, "Never expose user email addresses through the API", [], "user");
  expectConflict(ROOT, "Update the user profile endpoint to include name, avatar, and email address in the response", "Buried: expose email in response");
  expectSafe(ROOT, "Update the user profile endpoint to include name and avatar", "Profile update without email");

  // Positive intent against negative lock
  addLock(ROOT, "Never disable rate limiting on the API", [], "user");
  expectConflict(ROOT, "Turn off rate limiting because it's slowing down development", "Disable rate limiting");
  expectSafe(ROOT, "Increase the rate limit from 100 to 200 requests per minute", "Increase rate limit ≠ disable");
  expectSafe(ROOT, "Add better rate limit error messages for API consumers", "Improve rate limit UX");

  // Compound action with partial conflict
  addLock(ROOT, "The error logging configuration must not be changed", [], "user");
  expectConflict(ROOT, "Reconfigure error logging to use a different format", "Modify logging config");
  expectSafe(ROOT, "Add performance monitoring alongside the existing error logging", "Add monitoring ≠ change logging");
}

// ===================================================================
// SUMMARY
// ===================================================================
console.log("\n======================================================================");
console.log(`  REAL-WORLD TESTERS: ${passed}/${passed + failed} passed, ${failed} failed`);
console.log("======================================================================");

if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
}

if (failed === 0) {
  console.log("\nAll 5 testers + edge cases: ZERO false positives, ZERO missed violations.");
  console.log("External testers cannot point fingers at us.");
}

process.exit(failed > 0 ? 1 : 0);
