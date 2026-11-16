'use strict';
// TypeScript-only rules: places where the type checker is told to look away.
const { register } = require('../engine');
const { replace, ignore, matches } = require('./helpers');

register({
  id: 'no-explicit-any',
  languages: ['ts'],
  check(ctx) {
    const out = [];
    // `: any`, `as any`, `<any>`, `any[]` and `Array<any>`, but not names like `company` or `anything`
    for (const m of matches(ctx.code, /(?<=(?::|\bas|<|,|\|)\s*)\bany\b(?!\s*[:(])/)) {
      out.push({
        start: m.index, end: m.index + 3, severity: 'warning',
        message: 'Avoid the any type',
        why: 'any turns off type checking for this value and everything it touches, so typos and wrong ' +
          'types get through. unknown is just as flexible but makes you check the type before using it.',
        fixes: [
          { title: 'Change to unknown', edits: [replace(ctx.line, m.index, m.index + 3, 'unknown')] },
          { title: 'Keep any and mark this line as intended', edits: [ignore(ctx)] },
        ],
      });
    }
    return out;
  },
});

register({
  id: 'non-null-assertion',
  languages: ['ts'],
  check(ctx) {
    const out = [];
    // value!.prop or value![i]; `!=` and `!==` never match because they're followed by `=`
    for (const m of matches(ctx.code, /(?<=[\w)\]])!(?=\.|\[)/)) {
      const bracket = ctx.code[m.index + 1] === '[';
      out.push({
        start: m.index, end: m.index + 1, severity: 'warning',
        message: 'Non-null assertion (!) can hide a crash',
        why: '! tells TypeScript "trust me, this is never null or undefined." If it ever is, the code ' +
          'crashes at run time with no warning. Optional chaining (?.) returns undefined instead.',
        fixes: [
          {
            title: 'Use optional chaining (?.)',
            edits: [bracket ? replace(ctx.line, m.index, m.index + 1, '?.') : replace(ctx.line, m.index, m.index + 2, '?.')],
          },
          { title: 'Keep it and mark this line as intended', edits: [ignore(ctx)] },
        ],
      });
    }
    return out;
  },
});
