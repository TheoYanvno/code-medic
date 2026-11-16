'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { analyze, checkFixes } = require('../src/engine');
require('../src/rules');

const ids = (text) => analyze(text, 'python').map((i) => i.rule);

/** Applies a fix's edits, last first so earlier positions stay valid. Inserts may add lines. */
function apply(text, fix) {
  const lines = text.split('\n');
  const edits = [...fix.edits].sort((a, b) => b.line - a.line || b.start - a.start);
  for (const e of edits) {
    if (e.endLine !== undefined) { lines.splice(e.line, e.endLine - e.line); continue; }
    if (e.line === lines.length) lines.push('');
    const l = lines[e.line];
    lines[e.line] = l.slice(0, e.start) + e.text + l.slice(e.end);
  }
  return lines.join('\n').replace(/\n\n$/, '\n');
}

test('bare except is flagged and fixed two ways', () => {
  const text = 'try:\n    go()\nexcept:\n    pass';
  const [issue] = analyze(text, 'python');
  assert.strictEqual(issue.rule, 'bare-except');
  assert.ok(apply(text, issue.fixes[0]).includes('except Exception:'));
  assert.ok(apply(text, issue.fixes[1]).includes('except Exception as error:'));
  assert.deepStrictEqual(ids('try:\n    go()\nexcept ValueError:\n    pass'), []);
});

test('mutable default argument becomes None with a fresh value inside', () => {
  const text = 'def add(item, items=[]):\n    items.append(item)\n    return items';
  const [issue] = analyze(text, 'python');
  assert.strictEqual(issue.rule, 'mutable-default');
  assert.strictEqual(apply(text, issue.fixes[0]),
    'def add(item, items=None):\n    if items is None:\n        items = []\n    items.append(item)\n    return items');
  assert.strictEqual(apply(text, issue.fixes[1]).split('\n')[0], 'def add(item, items=()):');
});

test('mutable defaults: dicts, type hints and methods; plain values are fine', () => {
  assert.deepStrictEqual(ids('def f(opts: dict = {}):\n    pass'), ['mutable-default']);
  assert.deepStrictEqual(ids('class A:\n    def f(self, seen=set()):\n        pass'), ['mutable-default']);
  assert.deepStrictEqual(ids('def f(n=0, name="[]", flag=None):\n    pass'), []);
  assert.deepStrictEqual(ids('x = []'), []);
});

test('comparing to None', () => {
  const [issue] = analyze('if value == None:', 'python');
  assert.strictEqual(issue.fixes[0].edits[0].text, 'is None');
  assert.strictEqual(analyze('if value != None:', 'python')[0].fixes[0].edits[0].text, 'is not None');
  assert.deepStrictEqual(ids('if value is None:'), []);
  assert.deepStrictEqual(ids('msg = "x == None"  # y == None'), []);
});

test('leftover print can be removed or turned into logging (adding the import once)', () => {
  const text = 'def go():\n    print(x)\n    return x';
  const [issue] = analyze(text, 'python');
  assert.strictEqual(apply(text, issue.fixes[0]), 'def go():\n    return x');
  assert.strictEqual(apply(text, issue.fixes[1]), 'import logging\ndef go():\n    logging.debug(x)\n    return x');
  const withImport = analyze('import logging\nprint(x)', 'python')[0];
  assert.strictEqual(withImport.fixes[1].edits.length, 1);
  assert.deepStrictEqual(ids('pprint(x)'), []);
});

test('every Python issue explains why and offers exactly two fixes', () => {
  const text = 'def f(a=[]):\n    print(a)\n    if a == None:\n        pass\ntry:\n    f()\nexcept:\n    pass';
  const issues = analyze(text, 'python');
  assert.strictEqual(issues.length, 4);
  for (const issue of issues) {
    assert.ok(checkFixes(issue), issue.rule);
    assert.ok(issue.why.length > 20, issue.rule);
  }
});
