# 🩺 Code Medic

A VS Code extension that finds common mistakes in JavaScript, TypeScript and Python as you type, explains each one in plain words, and offers **two** ways to fix it from the Quick Fix menu (the light bulb, or Ctrl+.).

**Status:** in progress. The engine and the JavaScript/TypeScript rules are in; Python rules and Quick Fixes are next.

## How it works

- `src/engine.js` is the checker. It knows nothing about VS Code, so it's tested with plain Node.
- Before any rule runs, each line is **masked**: the inside of strings and comments is replaced with spaces, keeping every column in place. A rule can then search for `==` or `print(` without ever matching text in a string or a comment.
- `src/extension.js` runs the engine when a file opens and again 300 ms after you stop typing, and shows the results as diagnostics (squiggles and the Problems panel).
- Add `code-medic-ignore` in a comment at the end of a line to skip it.

## Run it

```bash
npm test                     # engine tests, no VS Code needed
```

To try the extension, open this folder in VS Code and press F5 (Run Extension).

## Planned

- JavaScript and TypeScript rules (loose equality, `var`, leftover `console.log` and `debugger`, `any`)
- Python rules (bare `except:`, mutable default arguments, `== None`, leftover `print`)
- Two Quick Fixes for every issue, plus a plain-English explanation of why it matters
- Settings to turn rules on or off and change their severity
- A "fix all" command, more rules and a packaged `.vsix`

## Credits

Built with help from AI coding tools; every feature is reviewed and tested before it ships.

## License

MIT. See [LICENSE](LICENSE).
