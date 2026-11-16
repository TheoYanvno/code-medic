'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { analyze, normalizeOptions, ruleList } = require('../src/engine');
require('../src/rules');
const manifest = require('../package.json');

const code = 'var a = 1;\nif (a == 2) { console.log(a); }';

test('with no settings every rule runs', () => {
  assert.deepStrictEqual(analyze(code, 'javascript').map((i) => i.rule), ['no-var', 'loose-equality', 'no-console-log']);
});

test('disabled rules are skipped', () => {
  const rules = analyze(code, 'javascript', { disabled: ['no-var', 'no-console-log'] }).map((i) => i.rule);
  assert.deepStrictEqual(rules, ['loose-equality']);
});

test('severity can be raised, lowered or turned off', () => {
  const issues = analyze(code, 'javascript', { severity: { 'loose-equality': 'error', 'no-var': 'off', 'no-console-log': 'shout' } });
  assert.deepStrictEqual(issues.map((i) => [i.rule, i.severity]), [['loose-equality', 'error'], ['no-console-log', 'info']]);
});

test('unknown levels are ignored', () => {
  assert.deepStrictEqual(normalizeOptions({ severity: { 'no-var': 'loud' } }).severity, {});
});

test('the settings list in package.json names every rule', () => {
  const listed = manifest.contributes.configuration.properties['codeMedic.disabledRules'].items.enum;
  assert.deepStrictEqual([...listed].sort(), ruleList().map((r) => r.id).sort());
});
