'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { analyze, checkFixes } = require('../src/engine');
require('../src/rules');

const ids = (text, lang = 'javascript') => analyze(text, lang).map((i) => i.rule);

/** Applies one fix's edits to the text (single-line edits are enough for these rules). */
function apply(text, fix) {
  const lines = text.split('\n');
  for (const e of [...fix.edits].reverse()) {
    if (e.endLine !== undefined) { lines.splice(e.line, e.endLine - e.line); continue; }
    const l = lines[e.line];
    lines[e.line] = l.slice(0, e.start) + e.text + l.slice(e.end);
  }
  return lines.join('\n');
}

test('loose equality is flagged, strict equality and arrows are not', () => {
  assert.deepStrictEqual(ids('if (a == b) {}'), ['loose-equality']);
  assert.deepStrictEqual(ids('if (a != b) {}'), ['loose-equality']);
  assert.deepStrictEqual(ids('if (a === b && c !== d && e <= f) { x.map((v) => v >= 2); }'), []);
  assert.deepStrictEqual(ids('const s = "a == b"; // c == d'), []);
});

test('loose equality fixes', () => {
  const [issue] = analyze('if (a == b) {}', 'javascript');
  assert.ok(checkFixes(issue));
  assert.strictEqual(apply('if (a == b) {}', issue.fixes[0]), 'if (a === b) {}');
  assert.strictEqual(apply('if (a == b) {}', issue.fixes[1]), 'if (a == b) {} // code-medic-ignore');
  assert.deepStrictEqual(ids(apply('if (a == b) {}', issue.fixes[1])), []);
});

test('var offers const and let', () => {
  const [issue] = analyze('var count = 0;', 'javascript');
  assert.strictEqual(issue.rule, 'no-var');
  assert.deepStrictEqual(issue.fixes.map((f) => apply('var count = 0;', f)), ['const count = 0;', 'let count = 0;']);
  assert.deepStrictEqual(ids('const variable = 1; // var x'), []);
});

test('leftover console.log and debugger can be removed or commented out', () => {
  const text = 'a();\n  console.log(x);\nb();';
  const [issue] = analyze(text, 'javascript');
  assert.strictEqual(issue.rule, 'no-console-log');
  assert.strictEqual(apply(text, issue.fixes[0]), 'a();\nb();');
  assert.strictEqual(apply(text, issue.fixes[1]), 'a();\n  // console.log(x);\nb();');
  assert.deepStrictEqual(ids('debugger;'), ['no-debugger']);
  assert.deepStrictEqual(ids('logger.log("console.log")'), []);
});

test('the same rules run for TypeScript', () => {
  assert.deepStrictEqual(ids('var n: number = 1;', 'typescript'), ['no-var']);
});

test('every issue explains why and offers exactly two fixes', () => {
  for (const issue of analyze('var a = 1;\nif (a == 2) { console.log(a); debugger; }', 'javascript')) {
    assert.ok(checkFixes(issue), issue.rule);
    assert.ok(issue.why.length > 20, issue.rule);
  }
});
