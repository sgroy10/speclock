/**
 * SpecLock Policy-as-Code Engine (v3.5)
 * Declarative YAML-based policy rules for enterprise constraint enforcement.
 *
 * Policy files: .speclock/policy.yml
 * Rules match file patterns + action types with enforcement levels.
 * Supports notifications, severity levels, and cross-org import/export.
 *
 * YAML parsing: lightweight built-in parser (no external deps).
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import fs from "fs";
import path from "path";
import { readBrain, writeBrain, appendEvent, newId, nowIso, bumpEvents } from "./storage.js";

// --- Lightweight YAML parser (handles policy.yml subset) ---

function parseYaml(text) {
  const lines = text.split("\n");
  const result = {};
  const stack = [{ obj: result, indent: -1 }];
  let currentArray = null;
  let currentArrayKey = null;
  let arrayItemIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim() || raw.trim().startsWith("#")) continue;

    const indent = raw.search(/\S/);
    const trimmed = raw.trim();

    // Array item
    if (trimmed.startsWith("- ")) {
      const value = trimmed.slice(2).trim();

      // Array of objects (- key: value)
      if (value.includes(":")) {
        const colonIdx = value.indexOf(":");
        const k = value.slice(0, colonIdx).trim();
        const v = value.slice(colonIdx + 1).trim();

        if (currentArray && currentArrayKey) {
          const item = {};
          item[k] = parseValue(v);
          currentArray.push(item);
          arrayItemIndent = indent;

          // Look ahead for more key-value pairs in this item
          let j = i + 1;
          while (j < lines.length) {
            const nextRaw = lines[j];
            if (!nextRaw.trim() || nextRaw.trim().startsWith("#")) { j++; continue; }
            const nextIndent = nextRaw.search(/\S/);
            const nextTrimmed = nextRaw.trim();
            if (nextIndent <= indent) break;
            if (nextTrimmed.startsWith("- ")) break;

            if (nextTrimmed.includes(":")) {
              const nc = nextTrimmed.indexOf(":");
              const nk = nextTrimmed.slice(0, nc).trim();
              const nv = nextTrimmed.slice(nc + 1).trim();

              // Empty value — determine type by peeking at next deeper line
              if (!nv) {
                // Peek at the next non-empty line with deeper indent
                let peekJ = j + 1;
                let peekLine = null;
                while (peekJ < lines.length) {
                  const pRaw = lines[peekJ];
                  if (pRaw.trim() && !pRaw.trim().startsWith("#")) {
                    const pIndent = pRaw.search(/\S/);
                    if (pIndent > nextIndent) {
                      peekLine = { indent: pIndent, trimmed: pRaw.trim() };
                    }
                    break;
                  }
                  peekJ++;
                }

                if (!peekLine) {
                  // No deeper content — empty string
                  item[nk] = "";
                  j++;
                  continue;
                }

                if (peekLine.trimmed.startsWith("- ")) {
                  // It's a flat array
                  item[nk] = [];
                  let k2 = j + 1;
                  while (k2 < lines.length) {
                    const subRaw = lines[k2];
                    if (!subRaw.trim() || subRaw.trim().startsWith("#")) { k2++; continue; }
                    const subIndent = subRaw.search(/\S/);
                    const subTrimmed = subRaw.trim();
                    if (subIndent <= nextIndent) break;
                    if (subTrimmed.startsWith("- ")) {
                      item[nk].push(parseValue(subTrimmed.slice(2).trim()));
                    }
                    k2++;
                  }
                  j = k2;
                  continue;
                }

                if (peekLine.trimmed.includes(":")) {
                  // It's a nested object
                  item[nk] = {};
                  let k2 = j + 1;
                  while (k2 < lines.length) {
                    const subRaw = lines[k2];
                    if (!subRaw.trim() || subRaw.trim().startsWith("#")) { k2++; continue; }
                    const subIndent = subRaw.search(/\S/);
                    const subTrimmed = subRaw.trim();
                    if (subIndent <= nextIndent) break;

                    if (subTrimmed.includes(":")) {
                      const sc = subTrimmed.indexOf(":");
                      const sk = subTrimmed.slice(0, sc).trim();
                      const sv = subTrimmed.slice(sc + 1).trim();

                      if (!sv) {
                        // Nested-nested: peek to determine array vs object
                        let peek2 = k2 + 1;
                        let isNestedArray = false;
                        while (peek2 < lines.length) {
                          const p2Raw = lines[peek2];
                          if (p2Raw.trim() && !p2Raw.trim().startsWith("#")) {
                            const p2Indent = p2Raw.search(/\S/);
                            if (p2Indent > subIndent && p2Raw.trim().startsWith("- ")) {
                              isNestedArray = true;
                            }
                            break;
                          }
                          peek2++;
                        }

                        if (isNestedArray) {
                          item[nk][sk] = [];
                          let k3 = k2 + 1;
                          while (k3 < lines.length) {
                            const sub2Raw = lines[k3];
                            if (!sub2Raw.trim() || sub2Raw.trim().startsWith("#")) { k3++; continue; }
                            const sub2Indent = sub2Raw.search(/\S/);
                            const sub2Trimmed = sub2Raw.trim();
                            if (sub2Indent <= subIndent) break;
                            if (sub2Trimmed.startsWith("- ")) {
                              item[nk][sk].push(parseValue(sub2Trimmed.slice(2).trim()));
                            }
                            k3++;
                          }
                          k2 = k3;
                          continue;
                        } else {
                          item[nk][sk] = "";
                        }
                      } else {
                        item[nk][sk] = parseValue(sv);
                      }
                    }
                    k2++;
                  }
                  j = k2;
                  continue;
                }

                // Fallback — treat as empty string
                item[nk] = "";
                j++;
                continue;
              }

              item[nk] = parseValue(nv);
            }
            j++;
          }
          i = j - 1;
        }
        continue;
      }

      // Simple array item
      if (currentArray) {
        currentArray.push(parseValue(value));
      }
      continue;
    }

    // Key-value pair
    if (trimmed.includes(":")) {
      const colonIdx = trimmed.indexOf(":");
      const key = trimmed.slice(0, colonIdx).trim();
      const value = trimmed.slice(colonIdx + 1).trim();

      // Pop stack to find parent
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      const parent = stack[stack.length - 1].obj;

      if (value === "" || value === undefined) {
        // Could be object or array — peek ahead
        const nextLine = lines[i + 1];
        if (nextLine && nextLine.trim().startsWith("- ")) {
          parent[key] = [];
          currentArray = parent[key];
          currentArrayKey = key;
          arrayItemIndent = -1;
        } else {
          parent[key] = {};
          stack.push({ obj: parent[key], indent });
          currentArray = null;
          currentArrayKey = null;
        }
      } else {
        parent[key] = parseValue(value);
        currentArray = null;
        currentArrayKey = null;
      }
    }
  }

  return result;
}

function parseValue(str) {
  if (!str) return "";
  // Remove quotes
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  // Boolean
  if (str === "true") return true;
  if (str === "false") return false;
  // Number
  if (/^-?\d+(\.\d+)?$/.test(str)) return Number(str);
  // Array shorthand [a, b, c]
  if (str.startsWith("[") && str.endsWith("]")) {
    const inner = str.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map(s => parseValue(s.trim()));
  }
  return str;
}

// --- Serialize to YAML ---

function toYaml(obj, indent = 0) {
  const pad = "  ".repeat(indent);
  let out = "";

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        out += `${pad}${key}: []\n`;
        continue;
      }
      out += `${pad}${key}:\n`;
      for (const item of value) {
        if (typeof item === "object" && item !== null) {
          const entries = Object.entries(item);
          if (entries.length > 0) {
            out += `${pad}  - ${entries[0][0]}: ${formatValue(entries[0][1])}\n`;
            for (let i = 1; i < entries.length; i++) {
              const [k, v] = entries[i];
              if (Array.isArray(v)) {
                if (v.length === 0) {
                  out += `${pad}    ${k}: []\n`;
                } else {
                  out += `${pad}    ${k}:\n`;
                  for (const sv of v) {
                    out += `${pad}      - ${formatValue(sv)}\n`;
                  }
                }
              } else if (typeof v === "object" && v !== null) {
                out += `${pad}    ${k}:\n`;
                out += toYaml(v, indent + 3);
              } else {
                out += `${pad}    ${k}: ${formatValue(v)}\n`;
              }
            }
          }
        } else {
          out += `${pad}  - ${formatValue(item)}\n`;
        }
      }
    } else if (typeof value === "object" && value !== null) {
      out += `${pad}${key}:\n`;
      out += toYaml(value, indent + 1);
    } else {
      out += `${pad}${key}: ${formatValue(value)}\n`;
    }
  }

  return out;
}

function formatValue(v) {
  if (typeof v === "string") {
    // Quote strings that look like numbers but should stay as strings (e.g., version "1.0")
    if (/^-?\d+(\.\d+)?$/.test(v)) {
      return `"${v}"`;
    }
    if (v.includes(":") || v.includes("#") || v.includes("'") || v.includes('"') || v.startsWith("*")) {
      return `"${v.replace(/"/g, '\\"')}"`;
    }
    return v;
  }
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  return String(v);
}

// --- Policy file paths ---

function policyPath(root) {
  return path.join(root, ".speclock", "policy.yml");
}

// --- Default policy template ---

function defaultPolicy() {
  return {
    version: "1.0",
    name: "Default Policy",
    description: "SpecLock policy-as-code rules",
    rules: [],
    notifications: {
      enabled: false,
      channels: [],
    },
  };
}

// --- Policy CRUD ---

/**
 * Load policy from .speclock/policy.yml
 */
export function loadPolicy(root) {
  const p = policyPath(root);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, "utf-8");
    return parseYaml(raw);
  } catch {
    return null;
  }
}

/**
 * Save policy to .speclock/policy.yml
 */
export function savePolicy(root, policy) {
  const p = policyPath(root);
  const yaml = `# SpecLock Policy-as-Code\n# Generated at ${nowIso()}\n# Docs: https://github.com/sgroy10/speclock\n\n${toYaml(policy)}`;
  fs.writeFileSync(p, yaml);
}

/**
 * Initialize policy with default template
 */
export function initPolicy(root) {
  const existing = loadPolicy(root);
  if (existing) {
    return { success: false, error: "Policy already exists. Use loadPolicy to read it." };
  }
  const policy = defaultPolicy();
  savePolicy(root, policy);

  // Log event
  const brain = readBrain(root);
  if (brain) {
    const eventId = newId("evt");
    appendEvent(root, { eventId, type: "policy_created", at: nowIso(), summary: "Policy-as-code initialized" });
    bumpEvents(brain, eventId);
    writeBrain(root, brain);
  }

  return { success: true, policy };
}

/**
 * Add a policy rule
 */
export function addPolicyRule(root, rule) {
  let policy = loadPolicy(root);
  if (!policy) {
    policy = defaultPolicy();
  }
  if (!Array.isArray(policy.rules)) policy.rules = [];

  // Validate rule
  if (!rule.name) return { success: false, error: "Rule name is required." };
  if (!rule.match) return { success: false, error: "Rule match criteria required (files, actions)." };
  if (!rule.enforce) rule.enforce = "warn";

  const ruleId = newId("rule");
  const policyRule = {
    id: ruleId,
    name: rule.name,
    description: rule.description || "",
    match: {
      files: rule.match.files || ["**/*"],
      actions: rule.match.actions || ["modify", "delete"],
    },
    enforce: rule.enforce, // block, warn, log
    severity: rule.severity || "medium",
    notify: rule.notify || [],
    active: true,
    createdAt: nowIso(),
  };

  policy.rules.push(policyRule);
  savePolicy(root, policy);

  // Log event
  const brain = readBrain(root);
  if (brain) {
    const eventId = newId("evt");
    appendEvent(root, { eventId, type: "policy_rule_added", at: nowIso(), summary: `Policy rule added: ${rule.name}`, ruleId });
    bumpEvents(brain, eventId);
    writeBrain(root, brain);
  }

  return { success: true, ruleId, rule: policyRule };
}

/**
 * Remove a policy rule by ID
 */
export function removePolicyRule(root, ruleId) {
  const policy = loadPolicy(root);
  if (!policy || !Array.isArray(policy.rules)) {
    return { success: false, error: "No policy found." };
  }

  const idx = policy.rules.findIndex(r => r.id === ruleId);
  if (idx === -1) {
    return { success: false, error: `Rule not found: ${ruleId}` };
  }

  const removed = policy.rules.splice(idx, 1)[0];
  savePolicy(root, policy);

  // Log event
  const brain = readBrain(root);
  if (brain) {
    const eventId = newId("evt");
    appendEvent(root, { eventId, type: "policy_rule_removed", at: nowIso(), summary: `Policy rule removed: ${removed.name}`, ruleId });
    bumpEvents(brain, eventId);
    writeBrain(root, brain);
  }

  return { success: true, removed };
}

/**
 * List all policy rules
 */
export function listPolicyRules(root) {
  const policy = loadPolicy(root);
  if (!policy || !Array.isArray(policy.rules)) {
    return { rules: [], total: 0, active: 0 };
  }
  return {
    rules: policy.rules,
    total: policy.rules.length,
    active: policy.rules.filter(r => r.active !== false).length,
  };
}

// --- Policy Evaluation ---

/**
 * Match a file path against glob patterns (simple matcher)
 */
function matchesPattern(filePath, pattern) {
  const normalized = filePath.replace(/\\/g, "/");
  const patternNorm = pattern.replace(/\\/g, "/");

  // Exact match
  if (normalized === patternNorm) return true;

  // Convert glob to regex — use placeholders to avoid interference between conversions
  const regex = patternNorm
    .replace(/\./g, "\\.")
    .replace(/\*\*\//g, "\x00GLOBSTAR\x00")
    .replace(/\*\*/g, "\x00DSTAR\x00")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, ".")
    .replace(/\x00GLOBSTAR\x00/g, "(.+/)?")
    .replace(/\x00DSTAR\x00/g, ".*");

  try {
    return new RegExp(`^${regex}$`, "i").test(normalized);
  } catch {
    return false;
  }
}

/**
 * Evaluate policy rules against a proposed action
 * Returns violations for any matching rules
 */
export function evaluatePolicy(root, action) {
  const policy = loadPolicy(root);
  if (!policy || !Array.isArray(policy.rules) || policy.rules.length === 0) {
    return { violations: [], passed: true, rulesChecked: 0 };
  }

  const activeRules = policy.rules.filter(r => r.active !== false);
  const violations = [];

  for (const rule of activeRules) {
    const match = matchesPolicyRule(rule, action);
    if (match.matched) {
      violations.push({
        ruleId: rule.id,
        ruleName: rule.name,
        description: rule.description,
        enforce: rule.enforce,
        severity: rule.severity,
        matchedFiles: match.matchedFiles,
        matchedAction: match.matchedAction,
        notify: rule.notify || [],
      });
    }
  }

  const blocked = violations.some(v => v.enforce === "block");

  return {
    violations,
    passed: violations.length === 0,
    blocked,
    rulesChecked: activeRules.length,
  };
}

/**
 * Check if a rule matches an action
 */
function matchesPolicyRule(rule, action) {
  const result = { matched: false, matchedFiles: [], matchedAction: null };

  if (!rule.match) return result;

  // Check action type match
  const actionTypes = rule.match.actions || ["modify", "delete", "create", "export"];
  const actionType = action.type || "modify";
  const actionMatched = actionTypes.includes(actionType) || actionTypes.includes("*");
  if (!actionMatched) return result;

  // Check file pattern match
  const filePatterns = rule.match.files || ["**/*"];
  const files = action.files || [];

  if (files.length === 0) {
    // No specific files — check if action description matches rule semantically
    const actionText = (action.description || action.text || "").toLowerCase();
    const ruleName = (rule.name || "").toLowerCase();
    const ruleDesc = (rule.description || "").toLowerCase();

    // Simple keyword overlap check
    const ruleWords = `${ruleName} ${ruleDesc}`.split(/\s+/).filter(w => w.length > 3);
    const actionWords = actionText.split(/\s+/).filter(w => w.length > 3);
    const overlap = ruleWords.filter(w => actionWords.some(aw => aw.includes(w) || w.includes(aw)));

    if (overlap.length > 0) {
      result.matched = true;
      result.matchedAction = actionType;
    }
    return result;
  }

  // Match files against patterns
  for (const file of files) {
    for (const pattern of filePatterns) {
      if (matchesPattern(file, pattern)) {
        result.matchedFiles.push(file);
        break;
      }
    }
  }

  if (result.matchedFiles.length > 0) {
    result.matched = true;
    result.matchedAction = actionType;
  }

  return result;
}

// --- Policy Import/Export ---

/**
 * Export policy as portable YAML string
 */
export function exportPolicy(root) {
  const policy = loadPolicy(root);
  if (!policy) {
    return { success: false, error: "No policy found." };
  }

  // Strip internal IDs and timestamps for portability
  const portable = {
    version: policy.version || "1.0",
    name: policy.name || "Exported Policy",
    description: policy.description || "",
    rules: (Array.isArray(policy.rules) ? policy.rules : []).map(r => ({
      name: r.name,
      description: r.description || "",
      match: r.match,
      enforce: r.enforce,
      severity: r.severity,
      notify: r.notify || [],
    })),
    notifications: policy.notifications || { enabled: false, channels: [] },
  };

  return { success: true, yaml: toYaml(portable), policy: portable };
}

/**
 * Import policy from YAML string (merges or replaces)
 */
export function importPolicy(root, yamlString, mode = "merge") {
  let imported;
  try {
    imported = parseYaml(yamlString);
  } catch (err) {
    return { success: false, error: `Failed to parse YAML: ${err.message}` };
  }

  if (!imported.rules || !Array.isArray(imported.rules)) {
    return { success: false, error: "Invalid policy: missing 'rules' array." };
  }

  let policy = loadPolicy(root);
  if (!policy || mode === "replace") {
    policy = defaultPolicy();
  }
  if (!Array.isArray(policy.rules)) policy.rules = [];

  let added = 0;
  for (const rule of imported.rules) {
    if (!rule.name) continue;

    // Check for duplicate names in merge mode
    if (mode === "merge") {
      const exists = policy.rules.some(r => r.name === rule.name);
      if (exists) continue;
    }

    const ruleId = newId("rule");
    policy.rules.push({
      id: ruleId,
      name: rule.name,
      description: rule.description || "",
      match: rule.match || { files: ["**/*"], actions: ["modify"] },
      enforce: rule.enforce || "warn",
      severity: rule.severity || "medium",
      notify: rule.notify || [],
      active: true,
      createdAt: nowIso(),
      imported: true,
    });
    added++;
  }

  if (imported.notifications) {
    policy.notifications = imported.notifications;
  }

  savePolicy(root, policy);

  // Log event
  const brain = readBrain(root);
  if (brain) {
    const eventId = newId("evt");
    appendEvent(root, { eventId, type: "policy_imported", at: nowIso(), summary: `Policy imported (${mode}): ${added} rules added` });
    bumpEvents(brain, eventId);
    writeBrain(root, brain);
  }

  return { success: true, added, total: policy.rules.length, mode };
}

// --- Notification helpers ---

/**
 * Generate notification payloads for policy violations
 * Returns webhook-ready payloads (actual sending done by integrations)
 */
export function generateNotifications(violations, projectName) {
  const notifications = [];

  for (const v of violations) {
    if (!v.notify || v.notify.length === 0) continue;

    for (const channel of v.notify) {
      notifications.push({
        channel,
        severity: v.severity,
        rule: v.ruleName,
        description: v.description,
        enforce: v.enforce,
        matchedFiles: v.matchedFiles || [],
        project: projectName || "unknown",
        timestamp: nowIso(),
      });
    }
  }

  return notifications;
}
