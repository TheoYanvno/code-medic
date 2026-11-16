'use strict';
// The diagnostics engine. It knows nothing about VS Code, so it can be tested with plain Node.
//
// analyze(text, languageId) runs every rule for that language over each line and returns issues:
//   { rule, line, start, end, severity, message, why, fixes: [{ title, edits: [{ line, start, end, text }] }] }
// Lines and columns are 0-based, like VS Code's. `end` is exclusive.
//
// Rules look at a "masked" copy of each line where the inside of strings and comments is blanked out
// with spaces, so `"a == b"` in a string or `# print(x)` in a comment never triggers a rule.
// Columns stay the same, so a match in the masked line points at the right place in the real line.

const LANGUAGES = {
  javascript: 'js', javascriptreact: 'js', typescript: 'ts', typescriptreact: 'ts', python: 'py',
};

const rules = { js: [], ts: [], py: [] };

/** Adds a rule. A rule is { id, languages: ['js', ...], check(ctx) -> issues }. */
function register(rule) {
  for (const lang of rule.languages) rules[lang].push(rule);
}

/**
 * Blanks out string and comment contents in one line, keeping the quote marks and the length.
 * `state` carries over between lines, for comments and strings that span several lines:
 * JS block comments and template literals, and Python triple-quoted strings (docstrings).
 */
function mask(line, lang, state = { inBlock: false, inString: null }) {
  const out = line.split('');
  let i = 0;
  const blank = (from, to) => { for (let k = from; k < to; k++) out[k] = ' '; };
  // Index of the closing delimiter at or after `from`, skipping backslash escapes; -1 if not on this line.
  const closing = (delim, from) => {
    for (let j = from; j < line.length; j++) {
      if (line[j] === '\\') { j++; continue; }
      if (line.startsWith(delim, j)) return j;
    }
    return -1;
  };
  while (i < line.length) {
    if (state.inBlock) {                                   // inside /* ... */ from an earlier line
      const close = line.indexOf('*/', i);
      if (close === -1) { blank(i, line.length); return out.join(''); }
      blank(i, close); state.inBlock = false; i = close + 2; continue;
    }
    if (state.inString) {                                  // inside a `template` or a docstring
      const close = closing(state.inString, i);
      if (close === -1) { blank(i, line.length); return out.join(''); }
      blank(i, close); i = close + state.inString.length; state.inString = null; continue;
    }
    const c = line[i];
    const two = line.slice(i, i + 2);
    const three = line.slice(i, i + 3);
    if (lang === 'py' && c === '#') { blank(i, line.length); break; }
    if (lang !== 'py' && two === '//') { blank(i, line.length); break; }
    if (lang !== 'py' && two === '/*') { state.inBlock = true; i += 2; continue; }
    if (lang === 'py' && (three === '"""' || three === "'''")) { state.inString = three; i += 3; continue; }
    if (lang !== 'py' && c === '`') { state.inString = '`'; i += 1; continue; }
    if (c === '"' || c === "'") {
      let j = closing(c, i + 1);
      if (j === -1) j = line.length;
      blank(i + 1, j);
      i = j + 1;
      continue;
    }
    i++;
  }
  return out.join('');
}

/** Lines that end with "code-medic-ignore" (in a comment) are skipped. */
const IGNORE = /code-medic-ignore/;

const LEVELS = ['error', 'warning', 'info'];

/**
 * Settings, all optional:
 *   disabled: ['no-var', ...]               rules to skip
 *   severity: { 'loose-equality': 'error' } per-rule level: error, warning, info, or off
 */
function normalizeOptions(options = {}) {
  const off = new Set(options.disabled || []);
  const severity = {};
  for (const [rule, level] of Object.entries(options.severity || {})) {
    if (level === 'off') off.add(rule);
    else if (LEVELS.includes(level)) severity[rule] = level;
  }
  return { off, severity };
}

function analyze(text, languageId, options) {
  const lang = LANGUAGES[languageId];
  if (!lang) return [];
  const { off, severity } = normalizeOptions(options);
  const active = rules[lang].filter((r) => !off.has(r.id));
  const lines = text.split(/\r?\n/);
  const state = { inBlock: false, inString: null };
  const masked = lines.map((l) => mask(l, lang, state));
  const issues = [];
  lines.forEach((raw, line) => {
    if (IGNORE.test(raw)) return;
    const ctx = { raw, code: masked[line], line, lines, masked, lang };
    for (const rule of active) {
      for (const issue of rule.check(ctx) || []) {
        issues.push({ rule: rule.id, line, ...issue, ...(severity[rule.id] && { severity: severity[rule.id] }) });
      }
    }
  });
  return issues.sort((a, b) => a.line - b.line || a.start - b.start);
}

/** Every rule id, with the languages it covers, for settings and docs. */
function ruleList() {
  const seen = new Map();
  for (const [lang, list] of Object.entries(rules)) {
    for (const r of list) seen.set(r.id, [...(seen.get(r.id) || []), lang]);
  }
  return [...seen].map(([id, languages]) => ({ id, languages }));
}

/** Every issue offers exactly two fixes; this keeps rule authors honest. */
function checkFixes(issue) {
  return Array.isArray(issue.fixes) && issue.fixes.length === 2 && issue.fixes.every((f) => f.title && f.edits.length);
}

module.exports = { analyze, register, mask, checkFixes, normalizeOptions, ruleList, LANGUAGES, LEVELS, rules };
