'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { analyze, mask, checkFixes, rules } = require('../src/engine');
const { applyEdits, toRange, planFixAll } = require('../src/fixes');
require('../src/rules');

const fix = (code, lang, which = 0, n = 0) => applyEdits(code, [...analyze(code, lang)[n].fixes[which].edits].map(toRange)
  .sort((a, b) => b.start.line - a.start.line || b.start.character - a.start.character));
const ids = (code, lang) => analyze(code, lang).map((i) => i.rule);

test('template literals across lines are masked', () => {
  const code = 'const s = `line one\nif (a == b) console.log(x)\nend`;\nif (c == d) {}';
  assert.deepStrictEqual(analyze(code, 'javascript').map((i) => [i.rule, i.line]), [['loose-equality', 3]]);
});

test('Python docstrings across lines are masked', () => {
  const code = 'def f():\n    """Example:\n    print(x == None)\n    """\n    return x == None';
  assert.deepStrictEqual(analyze(code, 'python').map((i) => [i.rule, i.line]), [['none-comparison', 4]]);
  const state = { inBlock: false, inString: null };
  mask("x = '''start", 'py', state);
  assert.strictEqual(mask("still print(x)''' + print(y)", 'py', state).includes('print(y)'), true);
});

test('an inline debugger is removed without taking the rest of the line', () => {
  assert.strictEqual(fix('if (bad) { debugger; }', 'javascript'), 'if (bad) { }');
  assert.strictEqual(fix('if (bad) { debugger; }', 'javascript', 1), 'if (bad) { /* debugger; */ }');
});

test('an inline console.log is removed as a whole call, nested parentheses included', () => {
  assert.strictEqual(fix('save(x); console.log(fmt(x), y); done();', 'javascript'), 'save(x); done();');
  assert.strictEqual(fix('  console.log(a);\nnext();', 'javascript'), 'next();');
});

test('a console.log or print() that continues on the next line is not touched', () => {
  assert.deepStrictEqual(ids('console.log(\n  a,\n  b);', 'javascript'), []);
  assert.deepStrictEqual(ids('print(\n    a)', 'python'), []);
});

test('parseInt needs a radix, but only when it has one argument', () => {
  assert.strictEqual(fix('const n = parseInt(input.value);', 'javascript'), 'const n = parseInt(input.value, 10);');
  assert.strictEqual(fix('const n = parseInt(s);', 'javascript', 1), 'const n = Number(s);');
  assert.deepStrictEqual(ids('parseInt(s, 16); parseInt(f(a, b), 10); parseInt();', 'javascript'), []);
});

test('comparing to True or False', () => {
  assert.strictEqual(fix('if done == True:', 'python'), 'if done is True:');
  assert.strictEqual(fix('if done != False:', 'python'), 'if done is not False:');
  assert.deepStrictEqual(ids('if done:\n    x = "== True"', 'python'), []);
});

test('Windows line endings and empty files', () => {
  assert.deepStrictEqual(analyze('var a = 1;\r\nif (a == 2) {}\r\n', 'javascript').map((i) => i.line), [0, 1]);
  assert.deepStrictEqual(analyze('', 'python'), []);
});

test('every issue from every rule offers exactly two fixes', () => {
  const samples = {
    javascript: 'var a = 1;\nif (a == 1) { debugger; }\nconsole.log(a);\nparseInt(a);',
    typescript: 'let b: any = x!.y;',
    python: 'def f(a=[]):\n    try:\n        pass\n    except:\n        print(a == None, a == True)',
  };
  const seen = new Set();
  for (const [lang, code] of Object.entries(samples)) {
    for (const issue of analyze(code, lang)) { assert.ok(checkFixes(issue), issue.rule); seen.add(issue.rule); }
  }
  const all = new Set(Object.values(rules).flat().map((r) => r.id).filter((id) => !id.startsWith('test-')));
  assert.deepStrictEqual([...all].filter((id) => !seen.has(id)), []);   // each rule is covered here
});

test('Fix All leaves an inline debugger line otherwise intact', () => {
  const code = 'if (a == b) { debugger; }';
  const plan = planFixAll(analyze(code, 'javascript'));
  assert.strictEqual(applyEdits(code, plan.edits), 'if (a === b) { }');
});
