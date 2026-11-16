'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { analyze } = require('../src/engine');
const { toRange, quickFixes, explain, findIssue } = require('../src/fixes');
require('../src/rules');

test('edits become ranges, including whole-line deletes', () => {
  assert.deepStrictEqual(toRange({ line: 2, start: 4, end: 6, text: '===' }),
    { start: { line: 2, character: 4 }, end: { line: 2, character: 6 }, text: '===' });
  assert.deepStrictEqual(toRange({ line: 1, start: 0, endLine: 2, end: 0, text: '' }).end, { line: 2, character: 0 });
});

test('each issue gives two Quick Fixes, the first preferred', () => {
  const [issue] = analyze('if (a == b) {}', 'javascript');
  const fixes = quickFixes(issue);
  assert.strictEqual(fixes.length, 2);
  assert.deepStrictEqual(fixes.map((f) => f.preferred), [true, false]);
  assert.match(fixes[0].title, /Change to === \(Code Medic\)/);
});

test('hover text says what, why and how to fix', () => {
  const [issue] = analyze('def f(a=[]):\n    pass', 'python');
  const text = explain(issue);
  assert.match(text, /Mutable default argument/);
  assert.match(text, /created once/);
  assert.match(text, /Ctrl\+\./);
});

test('a diagnostic finds its issue by rule and position', () => {
  const issues = analyze('var a = 1;\nif (a == 2) {}', 'javascript');
  assert.strictEqual(findIssue(issues, 'loose-equality', 1, 6).rule, 'loose-equality');
  assert.strictEqual(findIssue(issues, 'loose-equality', 0, 0), undefined);
});
