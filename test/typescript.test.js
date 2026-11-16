'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { analyze, checkFixes } = require('../src/engine');
require('../src/rules');

const apply = (text, edit) => {
  const lines = text.split('\n');
  const l = lines[edit.line];
  lines[edit.line] = l.slice(0, edit.start) + edit.text + l.slice(edit.end);
  return lines.join('\n');
};
const ts = (code) => analyze(code, 'typescript');

test('any is found in annotations, casts and generics', () => {
  const code = 'let a: any = 1;\nconst b = x as any;\nconst c: Array<any> = [];\nfunction f(d: string | any) {}';
  assert.deepStrictEqual(ts(code).filter((i) => i.rule === 'no-explicit-any').map((i) => i.line), [0, 1, 2, 3]);
});

test('names that contain "any" and strings are left alone', () => {
  assert.deepStrictEqual(ts('const company = getMany("any");\nlet anything = 2;'), []);
});

test('any becomes unknown', () => {
  const code = 'let a: any = 1;';
  const [issue] = ts(code);
  assert.ok(checkFixes(issue));
  assert.strictEqual(apply(code, issue.fixes[0].edits[0]), 'let a: unknown = 1;');
});

test('non-null assertions become optional chaining', () => {
  const code = 'const n = user!.name;';
  const [issue] = ts(code);
  assert.strictEqual(issue.rule, 'non-null-assertion');
  assert.strictEqual(apply(code, issue.fixes[0].edits[0]), 'const n = user?.name;');
  const arr = 'const first = items![0];';
  assert.strictEqual(apply(arr, ts(arr)[0].fixes[0].edits[0]), 'const first = items?.[0];');
});

test('!= and !== and logical not are not assertions', () => {
  assert.deepStrictEqual(ts('if (a !== b && !c.d) {}').filter((i) => i.rule === 'non-null-assertion'), []);
});

test('TypeScript rules do not run on JavaScript files', () => {
  assert.deepStrictEqual(analyze('const n = user!.name; let a /* : any */;', 'javascript'), []);
});
