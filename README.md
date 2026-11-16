# 🩺 Code Medic

A VS Code extension that finds common mistakes in JavaScript, TypeScript and Python as you type, explains each one in plain words, and offers **two** ways to fix it from the Quick Fix menu (the light bulb, or Ctrl+.).

**Status:** in progress. Rules for JavaScript, TypeScript and Python, two Quick Fixes per issue, hover explanations and settings are in; "fix all" and a status bar count are in; more rules and packaging are next.

## How it works

- `src/engine.js` is the checker. It knows nothing about VS Code, so it's tested with plain Node.
- Before any rule runs, each line is **masked**: the inside of strings and comments is replaced with spaces, keeping every column in place. A rule can then search for `==` or `print(` without ever matching text in a string or a comment.
- `src/extension.js` runs the engine when a file opens and again 300 ms after you stop typing, and shows the results as diagnostics (squiggles and the Problems panel).
- Each issue offers **two Quick Fixes** in the light-bulb menu (Ctrl+.), the safer one first, and hovering over it explains what's wrong and why it matters.
- **Fix all safe issues** (Command Palette or right-click) applies the first fix for every issue where it can't change what working code does: `==`, `None` comparisons, bare `except`, `debugger` and `!`. Issues that need your choice (`const` or `let`?) are left for the light bulb. One Ctrl+Z undoes it.
- The status bar shows how many issues the current file has; click it to open the Problems panel.
- A `console.log` or `debugger` that shares a line with other code is removed on its own, so `if (x) { debugger; }` keeps its `if`.
- Strings and comments that span lines (template literals, block comments, Python docstrings) are masked too.
- Add `code-medic-ignore` in a comment at the end of a line to skip it.

## Rules so far

| Rule | Language | Fix 1 | Fix 2 |
| --- | --- | --- | --- |
| `loose-equality` | JS/TS | Change `==` to `===` | Mark as intended |
| `no-var` | JS/TS | Change to `const` | Change to `let` |
| `no-console-log` | JS/TS | Remove it | Comment it out |
| `no-debugger` | JS/TS | Remove it | Comment it out |
| `parse-int-radix` | JS/TS | Add the radix `10` | Use `Number()` |
| `no-explicit-any` | TS | Change to `unknown` | Mark as intended |
| `non-null-assertion` | TS | Use `?.` instead of `!` | Mark as intended |
| `bare-except` | Python | `except Exception:` | `except Exception as error:` |
| `mutable-default` | Python | Default to `None`, create inside | Use `()` (lists) or mark as intended |
| `none-comparison` | Python | `is None` / `is not None` | Mark as intended |
| `leftover-print` | Python | Remove the line | Change to `logging.debug()` (adds the import) |
| `bool-comparison` | Python | `is True` / `is False` | Mark as intended |

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

- More rules and a packaged `.vsix`

## Credits

Built with help from AI coding tools; every feature is reviewed and tested before it ships.

## License

MIT. See [LICENSE](LICENSE).
