'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { analyze, register, mask } = require('../src/engine');

test('mask blanks strings and comments but keeps columns', () => {
  const line = 'if (a == "x == y") { // a == b';
  const m = mask(line, 'js');
  assert.strictEqual(m.length, line.length);
  assert.strictEqual(m.indexOf('=='), line.indexOf('=='));
  assert.strictEqual(m.lastIndexOf('=='), m.indexOf('=='));      // only the real one is left
});

test('mask handles Python comments, escapes and JS block comments across lines', () => {
  assert.strictEqual(mask('x = 1  # print(x)', 'py').includes('print'), false);
  assert.strictEqual(mask("s = 'it\\'s == fine'", 'py').includes('=='), false);
  const state = { inBlock: false };
  mask('/* start', 'js', state);
  assert.strictEqual(mask('still == comment */ a == b', 'js', state).indexOf('=='), 'still == comment */ a '.length);
});

test('analyze runs registered rules, skips ignored lines and unknown languages', () => {
  register({
    id: 'test-todo', languages: ['js'],
    check: ({ code }) => (code.includes('TODO_FN') ? [{ start: code.indexOf('TODO_FN'), end: code.indexOf('TODO_FN') + 7, severity: 'info', message: 'm', fixes: [] }] : []),
  });
  const issues = analyze('TODO_FN();\nTODO_FN(); // code-medic-ignore\nok();', 'javascript');
  assert.deepStrictEqual(issues.map((i) => [i.rule, i.line, i.start]), [['test-todo', 0, 0]]);
  assert.deepStrictEqual(analyze('TODO_FN();', 'markdown'), []);
});
