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

/** Blanks out string and comment contents in one line, keeping the quote marks and the length. */
function mask(line, lang, state = { inBlock: false }) {
  const out = line.split('');
  let i = 0;
  const blank = (from, to) => { for (let k = from; k < to; k++) out[k] = ' '; };
  while (i < line.length) {
    if (state.inBlock) {                                   // inside /* ... */ from an earlier line
      const close = line.indexOf('*/', i);
      if (close === -1) { blank(i, line.length); return out.join(''); }
      blank(i, close); state.inBlock = false; i = close + 2; continue;
    }
    const c = line[i];
    const two = line.slice(i, i + 2);
    if (lang === 'py' && c === '#') { blank(i, line.length); break; }
    if (lang !== 'py' && two === '//') { blank(i, line.length); break; }
    if (lang !== 'py' && two === '/*') { state.inBlock = true; i += 2; continue; }
    if (c === '"' || c === "'" || (c === '`' && lang !== 'py')) {
      let j = i + 1;
      while (j < line.length && line[j] !== c) j += line[j] === '\\' ? 2 : 1;
      blank(i + 1, Math.min(j, line.length));
      i = j + 1;
      continue;
    }
    i++;
  }
  return out.join('');
}

/** Lines that end with "code-medic-ignore" (in a comment) are skipped. */
const IGNORE = /code-medic-ignore/;

function analyze(text, languageId) {
  const lang = LANGUAGES[languageId];
  if (!lang) return [];
  const lines = text.split(/\r?\n/);
  const state = { inBlock: false };
  const masked = lines.map((l) => mask(l, lang, state));
  const issues = [];
  lines.forEach((raw, line) => {
    if (IGNORE.test(raw)) return;
    const ctx = { raw, code: masked[line], line, lines, masked, lang };
    for (const rule of rules[lang]) {
      for (const issue of rule.check(ctx) || []) issues.push({ rule: rule.id, line, ...issue });
    }
  });
  return issues.sort((a, b) => a.line - b.line || a.start - b.start);
}

/** Every issue offers exactly two fixes; this keeps rule authors honest. */
function checkFixes(issue) {
  return Array.isArray(issue.fixes) && issue.fixes.length === 2 && issue.fixes.every((f) => f.title && f.edits.length);
}

module.exports = { analyze, register, mask, checkFixes, LANGUAGES, rules };
