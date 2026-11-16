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

module.exports = { replace, removeLine, commentOut, ignore, matches };
