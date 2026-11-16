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

module.exports = { toRange, quickFixes, explain, findIssue };
