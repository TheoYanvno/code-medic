'use strict';
// VS Code glue: runs the engine on open and edited documents, shows the issues as diagnostics,
// offers two Quick Fixes for each one, and explains it on hover.
const vscode = require('vscode');
const { analyze, LANGUAGES } = require('./engine');
const { quickFixes, explain, findIssue } = require('./fixes');
require('./rules');                       // loads every rule set

const SEVERITY = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  info: vscode.DiagnosticSeverity.Information,
};
const SELECTOR = Object.keys(LANGUAGES).map((language) => ({ language }));

function toDiagnostic(issue) {
  const range = new vscode.Range(issue.line, issue.start, issue.line, issue.end);
  const d = new vscode.Diagnostic(range, issue.message, SEVERITY[issue.severity] || SEVERITY.warning);
  d.source = 'Code Medic';
  d.code = issue.rule;
  return d;
}

/** Reads the user's Code Medic settings. */
function settings() {
  const cfg = vscode.workspace.getConfiguration('codeMedic');
  return {
    enabled: cfg.get('enable', true),
    disabled: cfg.get('disabledRules', []),
    severity: cfg.get('severity', {}),
  };
}

function activate(context) {
  const collection = vscode.languages.createDiagnosticCollection('code-medic');
  const issuesByDoc = new Map();          // uri -> latest issues, so fixes and hovers can find them
  const timers = new Map();

  let options = settings();
  const check = (doc) => {
    if (!LANGUAGES[doc.languageId]) return;
    if (!options.enabled) { collection.delete(doc.uri); issuesByDoc.delete(doc.uri.toString()); return; }
    const issues = analyze(doc.getText(), doc.languageId, options);
    issuesByDoc.set(doc.uri.toString(), issues);
    collection.set(doc.uri, issues.map(toDiagnostic));
  };
  // Wait until typing pauses for 300 ms before checking, so big files stay responsive.
  const checkSoon = (doc) => {
    clearTimeout(timers.get(doc.uri.toString()));
    timers.set(doc.uri.toString(), setTimeout(() => check(doc), 300));
  };

  const fixProvider = {
    provideCodeActions(doc, _range, ctx) {
      const issues = issuesByDoc.get(doc.uri.toString()) || [];
      const actions = [];
      for (const diag of ctx.diagnostics) {
        if (diag.source !== 'Code Medic') continue;
        const issue = findIssue(issues, diag.code, diag.range.start.line, diag.range.start.character);
        if (!issue) continue;
        for (const fix of quickFixes(issue)) {
          const action = new vscode.CodeAction(fix.title, vscode.CodeActionKind.QuickFix);
          action.edit = new vscode.WorkspaceEdit();
          for (const e of fix.edits) {
            const range = new vscode.Range(e.start.line, e.start.character, e.end.line, e.end.character);
            action.edit.replace(doc.uri, range, e.text);
          }
          action.diagnostics = [diag];
          action.isPreferred = fix.preferred;
          actions.push(action);
        }
      }
      return actions;
    },
  };

  const hoverProvider = {
    provideHover(doc, pos) {
      const issues = issuesByDoc.get(doc.uri.toString()) || [];
      const hit = issues.find((i) => i.line === pos.line && pos.character >= i.start && pos.character <= i.end);
      return hit ? new vscode.Hover(new vscode.MarkdownString(explain(hit))) : undefined;
    },
  };

  context.subscriptions.push(
    collection,
    vscode.languages.registerCodeActionsProvider(SELECTOR, fixProvider, {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
    }),
    vscode.languages.registerHoverProvider(SELECTOR, hoverProvider),
    vscode.workspace.onDidOpenTextDocument(check),
    vscode.workspace.onDidChangeTextDocument((e) => checkSoon(e.document)),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      collection.delete(doc.uri);
      issuesByDoc.delete(doc.uri.toString());
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration('codeMedic')) return;
      options = settings();
      vscode.workspace.textDocuments.forEach(check);   // apply new settings right away
    }),
    vscode.commands.registerCommand('codeMedic.checkFile', () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) check(editor.document);
    }),
  );
  vscode.workspace.textDocuments.forEach(check);
}

function deactivate() {}

module.exports = { activate, deactivate };
