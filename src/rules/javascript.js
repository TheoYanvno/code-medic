'use strict';
// JavaScript and TypeScript rules. Each issue explains the problem and offers two fixes.
const { register } = require('../engine');
const { replace, ignore, matches, closeParen, removeStatement, commentOutStatement } = require('./helpers');

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

/** Leftover debugging statements: console.log(...) and debugger. */
function leftover(id, regex, label, why) {
  register({
    id,
    languages: JS,
    check(ctx) {
      const m = regex.exec(ctx.code);
      if (!m) return [];
      // The whole statement: through the matching ) for console.log(...), or just the keyword.
      let end = m.index + m[0].length;
      const open = ctx.code.indexOf('(', end);
      if (m[0].startsWith('console') && open !== -1 && /^\s*$/.test(ctx.code.slice(end, open))) {
        const close = closeParen(ctx.code, open);
        if (close === -1) return [];                        // spans lines: leave it to the person
        end = close + 1;
      }
      return [{
        start: m.index, end: m.index + m[0].length, severity: 'info',
        message: `Leftover ${label}`, why,
        fixes: [
          { title: 'Remove it', edits: [removeStatement(ctx, m.index, end)] },
          { title: 'Comment it out', edits: commentOutStatement(ctx, m.index, end) },
        ],
      }];
    },
  });
}

leftover('no-console-log', /\bconsole\.(log|debug)\b/, 'console.log',
  'Debug logging left in finished code clutters the console and can print data users should not see.');
leftover('no-debugger', /\bdebugger\b/, 'debugger statement',
  'debugger pauses the program whenever developer tools are open. It should never ship.');

register({
  id: 'parse-int-radix',
  languages: JS,
  check(ctx) {
    const out = [];
    for (const m of matches(ctx.code, /\bparseInt\s*\(/)) {
      const open = m.index + m[0].length - 1;
      const close = closeParen(ctx.code, open);
      if (close === -1) continue;
      // Only flag a single argument: look for a comma at the top level inside the parentheses.
      let depth = 0;
      let comma = false;
      for (let i = open + 1; i < close; i++) {
        const c = ctx.code[i];
        if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c)) depth--;
        else if (c === ',' && depth === 0) comma = true;
      }
      if (comma || !ctx.code.slice(open + 1, close).trim()) continue;
      out.push({
        start: m.index, end: m.index + 'parseInt'.length, severity: 'warning',
        message: 'parseInt without a radix',
        why: 'Without the second argument, parseInt guesses the number base from the text: "0x1F" is read ' +
          'as hexadecimal. Passing 10 makes it always read decimal numbers.',
        fixes: [
          { title: 'Add the radix 10', edits: [replace(ctx.line, close, close, ', 10')] },
          { title: 'Use Number() instead (stricter: "12px" becomes NaN)', edits: [replace(ctx.line, m.index, m.index + 'parseInt'.length, 'Number')] },
        ],
      });
    }
    return out;
  },
});
