'use strict';
// JavaScript and TypeScript rules. Each issue explains the problem and offers two fixes.
const { register } = require('../engine');
const { replace, removeLine, commentOut, ignore, matches } = require('./helpers');

const JS = ['js', 'ts'];

register({
  id: 'loose-equality',
  languages: JS,
  check(ctx) {
    const out = [];
    // == or != that isn't part of ===, !==, <=, >= or =>
    for (const m of matches(ctx.code, /(?<![=!<>])(==|!=)(?!=)/)) {
      const strict = m[1] === '==' ? '===' : '!==';
      out.push({
        start: m.index, end: m.index + 2, severity: 'warning',
        message: `Use ${strict} instead of ${m[1]}`,
        why: `${m[1]} converts values before comparing, so 0 == "" and null == undefined are both true. ` +
          `${strict} compares without converting, which is almost always what you mean.`,
        fixes: [
          { title: `Change to ${strict}`, edits: [replace(ctx.line, m.index, m.index + 2, strict)] },
          { title: 'Keep it and mark this line as intended', edits: [ignore(ctx)] },
        ],
      });
    }
    return out;
  },
});

register({
  id: 'no-var',
  languages: JS,
  check(ctx) {
    const out = [];
    for (const m of matches(ctx.code, /\bvar\s+(?=[A-Za-z_$[{])/)) {
      out.push({
        start: m.index, end: m.index + 3, severity: 'warning',
        message: 'Use let or const instead of var',
        why: 'var is visible in the whole function, not just the block it is in, and can be used before ' +
          'its line runs. let and const stay inside their block, which avoids surprising bugs.',
        fixes: [
          { title: 'Change to const (value never reassigned)', edits: [replace(ctx.line, m.index, m.index + 3, 'const')] },
          { title: 'Change to let (value gets reassigned)', edits: [replace(ctx.line, m.index, m.index + 3, 'let')] },
        ],
      });
    }
    return out;
  },
});

/** Leftover debugging lines: console.log(...) and debugger. */
function leftover(id, regex, label, why) {
  register({
    id,
    languages: JS,
    check(ctx) {
      const m = regex.exec(ctx.code);
      if (!m) return [];
      return [{
        start: m.index, end: m.index + m[0].length, severity: 'info',
        message: `Leftover ${label}`, why,
        fixes: [
          { title: 'Remove this line', edits: [removeLine(ctx)] },
          { title: 'Comment it out', edits: [commentOut(ctx)] },
        ],
      }];
    },
  });
}

leftover('no-console-log', /\bconsole\.(log|debug)\b/, 'console.log',
  'Debug logging left in finished code clutters the console and can print data users should not see.');
leftover('no-debugger', /\bdebugger\b/, 'debugger statement',
  'debugger pauses the program whenever developer tools are open. It should never ship.');
