'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { analyze } = require('../src/engine');
const { planFixAll, applyEdits, statusText } = require('../src/fixes');
require('../src/rules');

const fixAll = (code, lang) => {
  const plan = planFixAll(analyze(code, lang));
  return { ...plan, text: applyEdits(code, plan.edits) };
};

test('fixes every safe issue in one go, including two on one line', () => {
  const code = 'if (a == b || c != d) {\n  debugger;\n}\nvar x = 1;';
  const r = fixAll(code, 'javascript');
  assert.strictEqual(r.text, 'if (a === b || c !== d) {\n}\nvar x = 1;');
  assert.deepStrictEqual([r.fixed, r.left], [3, 1]);   // var needs a choice: const or let
});

test('Python: bare except and None comparisons', () => {
  const code = 'try:\n    go()\nexcept:\n    if x == None:\n        pass';
  assert.strictEqual(fixAll(code, 'python').text, 'try:\n    go()\nexcept Exception:\n    if x is None:\n        pass');
});

test('TypeScript: ! becomes ?. but any is left for you', () => {
  const r = fixAll('const n = user!.name as any;', 'typescript');
  assert.strictEqual(r.text, 'const n = user?.name as any;');
  assert.strictEqual(r.left, 1);
});

test('running Fix All twice changes nothing the second time', () => {
  const once = fixAll('if (a == 1) {\n  debugger;\n}\nif (b != 2) {}', 'javascript').text;
  assert.strictEqual(fixAll(once, 'javascript').fixed, 0);
});

test('nothing to fix leaves the text alone', () => {
  assert.strictEqual(fixAll('const a = 1;', 'javascript').text, 'const a = 1;');
});

test('status bar text', () => {
  assert.strictEqual(statusText([]), '$(check) Code Medic');
  assert.strictEqual(statusText([{}]), '$(pulse) Code Medic: 1 issue');
  assert.strictEqual(statusText([{}, {}]), '$(pulse) Code Medic: 2 issues');
});
