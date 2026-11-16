# 🩺 Code Medic

A VS Code extension that finds common mistakes in JavaScript, TypeScript and Python as you type, explains each one in plain words, and offers **two** ways to fix it from the Quick Fix menu (the light bulb, or Ctrl+.).

**Status:** in progress. Rules for JavaScript, TypeScript and Python, two Quick Fixes per issue, hover explanations and settings are in; a "fix all" command is next.

## How it works

- `src/engine.js` is the checker. It knows nothing about VS Code, so it's tested with plain Node.
- Before any rule runs, each line is **masked**: the inside of strings and comments is replaced with spaces, keeping every column in place. A rule can then search for `==` or `print(` without ever matching text in a string or a comment.
- `src/extension.js` runs the engine when a file opens and again 300 ms after you stop typing, and shows the results as diagnostics (squiggles and the Problems panel).
- Each issue offers **two Quick Fixes** in the light-bulb menu (Ctrl+.), the safer one first, and hovering over it explains what's wrong and why it matters.
- Add `code-medic-ignore` in a comment at the end of a line to skip it.

## Rules so far

| Rule | Language | Fix 1 | Fix 2 |
| --- | --- | --- | --- |
| `loose-equality` | JS/TS | Change `==` to `===` | Mark as intended |
| `no-var` | JS/TS | Change to `const` | Change to `let` |
| `no-console-log` | JS/TS | Remove the line | Comment it out |
| `no-debugger` | JS/TS | Remove the line | Comment it out |
| `no-explicit-any` | TS | Change to `unknown` | Mark as intended |
| `non-null-assertion` | TS | Use `?.` instead of `!` | Mark as intended |
| `bare-except` | Python | `except Exception:` | `except Exception as error:` |
| `mutable-default` | Python | Default to `None`, create inside | Use `()` (lists) or mark as intended |
| `none-comparison` | Python | `is None` / `is not None` | Mark as intended |
| `leftover-print` | Python | Remove the line | Change to `logging.debug()` (adds the import) |

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `codeMedic.enable` | `true` | Check files as you type |
| `codeMedic.disabledRules` | `[]` | Rules to turn off, e.g. `["no-var"]` |
| `codeMedic.severity` | `{}` | Change a rule's level: `error`, `warning`, `info` or `off`, e.g. `{ "loose-equality": "error" }` |

Changes apply right away to every open file.

## Run it

```bash
npm test                     # engine tests, no VS Code needed
```

To try the extension, open this folder in VS Code and press F5 (Run Extension).

## Planned

- A "fix all" command, more rules and a packaged `.vsix`

## Credits

Built with help from AI coding tools; every feature is reviewed and tested before it ships.

## License

MIT. See [LICENSE](LICENSE).
