'use strict';
// Python rules. Each issue explains the problem and offers two fixes.
const { register } = require('../engine');
const { replace, removeLine, ignore, matches } = require('./helpers');

register({
  id: 'bare-except',
  languages: ['py'],
  check(ctx) {
    const m = /^(\s*)except\s*:/.exec(ctx.code);
    if (!m) return [];
    const start = m[1].length;
    const end = ctx.code.indexOf(':', start) + 1;
    return [{
      start, end, severity: 'warning',
      message: 'Bare except: catches everything',
      why: 'A bare except also catches KeyboardInterrupt and SystemExit, so Ctrl+C stops working and real ' +
        'bugs get hidden. Catch the errors you expect instead.',
      fixes: [
        { title: 'Change to except Exception:', edits: [replace(ctx.line, start, end, 'except Exception:')] },
        { title: 'Change to except Exception as error: (to log or inspect it)', edits: [replace(ctx.line, start, end, 'except Exception as error:')] },
      ],
    }];
  },
});

register({
  id: 'mutable-default',
  languages: ['py'],
  check(ctx) {
    if (!/^\s*(async\s+)?def\s/.test(ctx.code)) return [];
    const out = [];
    for (const m of matches(ctx.code, /(\b[A-Za-z_]\w*)(\s*(?::[^=,)]+)?=\s*)(\[\s*\]|\{\s*\}|set\(\s*\)|list\(\s*\)|dict\(\s*\))/)) {
      const name = m[1];
      const valueStart = m.index + m[1].length + m[2].length;
      const valueEnd = valueStart + m[3].length;
      const empty = m[3].replace(/\s/g, '');
      const fresh = { '[]': '[]', '{}': '{}', 'set()': 'set()', 'list()': '[]', 'dict()': '{}' }[empty];
      // Insert the None check as the first lines of the body, one indent deeper than the def.
      const indent = ctx.raw.match(/^\s*/)[0] + '    ';
      const body = { line: ctx.line + 1, start: 0, end: 0, text: `${indent}if ${name} is None:\n${indent}    ${name} = ${fresh}\n` };
      const second = fresh === '[]'
        ? { title: 'Use an empty tuple () if the function only reads it', edits: [replace(ctx.line, valueStart, valueEnd, '()')] }
        : { title: 'Keep it and mark this line as intended', edits: [ignore(ctx)] };
      out.push({
        start: valueStart, end: valueEnd, severity: 'warning',
        message: `Mutable default argument: ${name}=${m[3]}`,
        why: 'Default values are created once, when the function is defined, so every call shares the same ' +
          `${fresh}. Changes from one call show up in the next.`,
        fixes: [
          { title: `Default to None and create a new ${fresh} inside`, edits: [replace(ctx.line, valueStart, valueEnd, 'None'), body] },
          second,
        ],
      });
    }
    return out;
  },
});

register({
  id: 'none-comparison',
  languages: ['py'],
  check(ctx) {
    const out = [];
    for (const m of matches(ctx.code, /(==|!=)\s*None\b/)) {
      const better = m[1] === '==' ? 'is None' : 'is not None';
      out.push({
        start: m.index, end: m.index + m[0].length, severity: 'info',
        message: `Use "${better}" instead of "${m[0]}"`,
        why: 'None is a single object, so Python style (PEP 8) checks it with "is". "==" can be changed by ' +
          'a class\'s __eq__ method and give a wrong answer.',
        fixes: [
          { title: `Change to ${better}`, edits: [replace(ctx.line, m.index, m.index + m[0].length, better)] },
          { title: 'Keep it and mark this line as intended', edits: [ignore(ctx)] },
        ],
      });
    }
    return out;
  },
});

register({
  id: 'leftover-print',
  languages: ['py'],
  check(ctx) {
    const m = /^(\s*)print\(/.exec(ctx.code);
    if (!m) return [];
    const start = m[1].length;
    const hasLogging = ctx.lines.some((l) => /^\s*import logging\b/.test(l));
    const edits = [replace(ctx.line, start, start + 'print'.length, 'logging.debug')];
    if (!hasLogging) edits.unshift({ line: 0, start: 0, end: 0, text: 'import logging\n' });
    return [{
      start, end: start + 5, severity: 'info',
      message: 'print() left in the code',
      why: 'print() calls used for debugging end up in the program\'s output. The logging module can be ' +
        'turned up or down without editing the code.',
      fixes: [
        { title: 'Remove this line', edits: [removeLine(ctx)] },
        { title: 'Change to logging.debug()', edits },
      ],
    }];
  },
});
