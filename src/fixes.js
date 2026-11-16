'use strict';
// Turns the engine's fixes into plain position ranges. Kept free of VS Code so it can be tested.

/** An engine edit -> { start: {line, character}, end: {line, character}, text }. */
function toRange(edit) {
  return {
    start: { line: edit.line, character: edit.start },
    end: { line: edit.endLine ?? edit.line, character: edit.end },
    text: edit.text,
  };
}

/** Quick Fix entries for one issue: two actions, the first marked as preferred. */
function quickFixes(issue) {
  return issue.fixes.map((fix, i) => ({
    title: `${fix.title} (Code Medic)`,
    preferred: i === 0,
    edits: fix.edits.map(toRange),
  }));
}

/** The hover text for an issue: what's wrong, why it matters, and how to fix it. */
function explain(issue) {
  return [
    `**Code Medic: ${issue.message}**`,
    '',
    issue.why,
    '',
    `Fix it from the light bulb (Ctrl+.): ${issue.fixes.map((f) => `"${f.title}"`).join(' or ')}.`,
  ].join('\n');
}

/** Finds the issue behind a diagnostic by rule and position. */
function findIssue(issues, rule, line, start) {
  return issues.find((i) => i.rule === rule && i.line === line && i.start === start);
}

/**
 * Rules whose first fix is safe to apply without looking: it never changes what correct code does.
 * The others (const or let? remove the line or comment it out?) need a choice, so Fix All leaves them.
 */
const FIX_ALL_SAFE = new Set(['loose-equality', 'none-comparison', 'bare-except', 'no-debugger', 'non-null-assertion']);

const cmp = (a, b) => a.line - b.line || a.character - b.character;
const isInsert = (r) => cmp(r.start, r.end) === 0;
/** Two edits clash if their ranges share any text, or if both insert at the same spot. */
const clash = (a, b) => (cmp(a.start, b.end) < 0 && cmp(b.start, a.end) < 0) ||
  (isInsert(a) && isInsert(b) && cmp(a.start, b.start) === 0);

/**
 * The edits Fix All would make: the first fix of every safe issue, skipping any whose edits would
 * clash with one already chosen. Returned bottom-up, so applying them in order never shifts the rest.
 */
function planFixAll(issues) {
  const chosen = [];
  let fixed = 0;
  for (const issue of issues) {
    if (!FIX_ALL_SAFE.has(issue.rule)) continue;
    const ranges = issue.fixes[0].edits.map(toRange);
    if (ranges.some((r) => chosen.some((c) => clash(r, c)))) continue;
    chosen.push(...ranges);
    fixed++;
  }
  chosen.sort((a, b) => cmp(b.start, a.start));
  return { edits: chosen, fixed, left: issues.length - fixed };
}

/** Applies range edits (bottom-up, as planFixAll returns them) to text. Used by tests. */
function applyEdits(text, edits) {
  const lines = text.split('\n');
  for (const e of edits) {
    const head = lines[e.start.line].slice(0, e.start.character);
    const tail = lines[e.end.line].slice(e.end.character);
    lines.splice(e.start.line, e.end.line - e.start.line + 1, ...(head + e.text + tail).split('\n'));
  }
  return lines.join('\n');
}

/** Status bar text for a file's issue count. */
function statusText(issues) {
  if (!issues.length) return '$(check) Code Medic';
  return `$(pulse) Code Medic: ${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}`;
}

module.exports = { toRange, quickFixes, explain, findIssue, planFixAll, applyEdits, statusText, FIX_ALL_SAFE };
