// Debug: what does extractPrimaryVerb return for G2 failing actions?
// We can't import it directly (not exported), so let's use scoreConflict with debug

import { scoreConflict } from '../src/core/semantics.js';

// The issue: Check 3c requires actionPrimaryVerb to be set
// But "update" might not be in any marker list

// Let me just test: does "update" appear in POSITIVE/NEGATIVE/NEUTRAL?
const POSITIVE = [
  "enable", "activate", "turn on", "switch on", "start",
  "add", "create", "implement", "introduce", "set up", "build",
  "install", "deploy", "launch", "initialize",
  "enforce", "strengthen", "harden", "improve", "enhance",
  "increase", "expand", "extend", "upgrade", "boost",
  "verify", "validate", "check", "confirm", "ensure",
  "protect", "secure", "guard", "shield", "defend",
  "restore", "recover", "repair", "fix", "resolve",
  "maintain", "preserve", "keep", "retain", "uphold",
  "monitor", "track", "observe", "watch",
  "document", "record", "log", "report",
  "comply", "adhere", "follow",
  "view", "read", "inspect", "review", "examine",
  "test", "scan", "detect", "encrypt",
];
const NEGATIVE = [
  "disable", "deactivate", "turn off", "switch off", "stop",
  "remove", "delete", "drop", "destroy", "kill", "purge",
  "wipe", "erase", "eliminate", "nuke",
  "uninstall", "disconnect", "detach",
  "weaken", "loosen", "relax", "reduce", "lower",
  "bypass", "circumvent", "skip", "ignore", "avoid",
  "override", "overrule", "suppress",
  "break", "violate", "breach",
  "downgrade", "rollback", "revert",
  "truncate", "empty", "clear", "flush",
  "expose", "leak", "reveal",
  "pause", "suspend", "freeze", "halt",
];
const NEUTRAL = [
  "modify", "change", "alter", "reconfigure", "rework",
  "overhaul", "restructure", "refactor", "redesign",
  "replace", "swap", "switch", "migrate", "transition", "substitute",
  "touch", "mess", "configure", "optimize", "tweak",
  "extend", "shorten", "adjust", "customize", "personalize",
];

console.log('"update" in POSITIVE:', POSITIVE.includes("update"));
console.log('"update" in NEGATIVE:', NEGATIVE.includes("update"));
console.log('"update" in NEUTRAL:', NEUTRAL.includes("update"));
console.log('"write" in POSITIVE:', POSITIVE.includes("write"));
console.log('"write" in NEGATIVE:', NEGATIVE.includes("write"));
console.log('"write" in NEUTRAL:', NEUTRAL.includes("write"));

// So extractPrimaryVerb("Update the Stripe UI...") returns null because "update" isn't in any list
// That means actionPrimaryVerb is null and Check 3c's guard `if (!intentAligned && actionPrimaryVerb)` fails!

// But wait, EUPHEMISM_MAP is also checked. Let me see if "update" is there...
// The function also checks euphemism keys. "update" might not be there either.

// Confirmed: actionPrimaryVerb is null/undefined for "Update..." actions
// Fix: add "update" to NEUTRAL_ACTION_VERBS (or POSITIVE_INTENT_MARKERS)
// Also add "write" to POSITIVE_INTENT_MARKERS
