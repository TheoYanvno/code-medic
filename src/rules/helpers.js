'use strict';
// Small builders for the fixes rules offer. An edit replaces text from (line, start) to
// (endLine ?? line, end) with `text`.

const replace = (line, start, end, text) => ({ line, start, end, text });

/** Deletes a whole line, including its line break, so no empty line is left behind. */
function removeLine(ctx) {
  const last = ctx.line === ctx.lines.length - 1;
  return last
    ? { line: ctx.line, start: 0, end: ctx.raw.length, text: '' }
    : { line: ctx.line, start: 0, endLine: ctx.line + 1, end: 0, text: '' };
}

/** Turns the line into a comment, keeping its indentation. */
function commentOut(ctx) {
  const indent = ctx.raw.match(/^\s*/)[0].length;
  return { line: ctx.line, start: indent, end: indent, text: ctx.lang === 'py' ? '# ' : '// ' };
}

/** Marks the line as intentional so Code Medic stops flagging it. */
function ignore(ctx) {
  const marker = ctx.lang === 'py' ? '  # code-medic-ignore' : ' // code-medic-ignore';
  return { line: ctx.line, start: ctx.raw.length, end: ctx.raw.length, text: marker };
}

/** Every match of a regex in a masked line, as { index, match }. */
function* matches(code, regex) {
  const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
  let m;
  while ((m = re.exec(code))) {
    yield m;
    if (m[0] === '') re.lastIndex++;
  }
}

/** Index of the ) that closes the ( at `open` in a masked line, or -1 if it closes on a later line. */
function closeParen(code, open) {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === '(') depth++;
    else if (code[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

/** True if the masked line has nothing but whitespace (and a `;`) outside start..end. */
function aloneOnLine(ctx, start, end) {
  return /^\s*$/.test(ctx.code.slice(0, start)) && /^\s*;?\s*$/.test(ctx.code.slice(end));
}

/**
 * Removes one statement. If it's alone on its line the whole line goes; if it shares the line with
 * other code (`if (x) { debugger; }`), only the statement, its `;` and one space after it go.
 */
function removeStatement(ctx, start, end) {
  if (aloneOnLine(ctx, start, end)) return removeLine(ctx);
  let stop = end;
  if (ctx.code[stop] === ';') stop++;
  if (ctx.code[stop] === ' ') stop++;
  return { line: ctx.line, start, end: stop, text: '' };
}

/** Comments out one statement: the whole line if it's alone, otherwise wraps it in a block comment. */
function commentOutStatement(ctx, start, end) {
  if (aloneOnLine(ctx, start, end)) return [commentOut(ctx)];
  const stop = ctx.code[end] === ';' ? end + 1 : end;
  return [{ line: ctx.line, start: stop, end: stop, text: ' */' }, { line: ctx.line, start, end: start, text: '/* ' }];
}

module.exports = { replace, removeLine, commentOut, ignore, matches, closeParen, aloneOnLine, removeStatement, commentOutStatement };
