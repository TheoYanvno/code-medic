'use strict';
// VS Code glue: runs the engine on open and edited documents, shows the issues as diagnostics,
// offers two Quick Fixes for each one, and explains it on hover.
const vscode = require('vscode');
const { analyze, LANGUAGES } = require('./engine');
const { quickFixes, explain, findIssue, planFixAll, statusText } = require('./fixes');
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

  // Status bar: the issue count for the file in front of you; click it to open the Problems panel.
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  status.command = 'workbench.actions.view.problems';
  const showStatus = () => {
    const doc = vscode.window.activeTextEditor?.document;
    if (!doc || !LANGUAGES[doc.languageId] || !options.enabled) { status.hide(); return; }
    const issues = issuesByDoc.get(doc.uri.toString()) || [];
    status.text = statusText(issues);
    status.tooltip = issues.length ? 'Code Medic: click to see the issues in this file' : 'Code Medic: no issues in this file';
    status.show();
  };

  let options = settings();
  const check = (doc) => {
    if (!LANGUAGES[doc.languageId]) return;
    if (!options.enabled) { collection.delete(doc.uri); issuesByDoc.delete(doc.uri.toString()); return; }
    const issues = analyze(doc.getText(), doc.languageId, options);
    issuesByDoc.set(doc.uri.toString(), issues);
    collection.set(doc.uri, issues.map(toDiagnostic));
    showStatus();
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
      showStatus();
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration('codeMedic')) return;
      options = settings();
      vscode.workspace.textDocuments.forEach(check);   // apply new settings right away
      showStatus();
    }),
    vscode.commands.registerCommand('codeMedic.checkFile', () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) check(editor.document);
    }),
    vscode.commands.registerCommand('codeMedic.fixAll', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !LANGUAGES[editor.document.languageId]) return;
      const doc = editor.document;
      check(doc);                                       // make sure the issues match the text
      const plan = planFixAll(issuesByDoc.get(doc.uri.toString()) || []);
      if (!plan.fixed) {
        vscode.window.showInformationMessage('Code Medic: nothing to fix automatically in this file.');
        return;
      }
      const edit = new vscode.WorkspaceEdit();
      for (const e of plan.edits) {
        edit.replace(doc.uri, new vscode.Range(e.start.line, e.start.character, e.end.line, e.end.character), e.text);
      }
      await vscode.workspace.applyEdit(edit);           // one undo step puts it all back
      check(doc);
      const left = plan.left ? ` ${plan.left} left that ${plan.left === 1 ? 'needs' : 'need'} your choice (use the light bulb).` : '';
      vscode.window.showInformationMessage(`Code Medic fixed ${plan.fixed} ${plan.fixed === 1 ? 'issue' : 'issues'}.${left}`);
    }),
    status,
    vscode.window.onDidChangeActiveTextEditor(showStatus),
  );
  vscode.workspace.textDocuments.forEach(check);
}

function deactivate() {}

module.exports = { activate, deactivate };
