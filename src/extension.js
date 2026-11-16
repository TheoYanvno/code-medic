'use strict';
// VS Code glue: runs the engine on open and edited documents and shows the issues as diagnostics.
const vscode = require('vscode');
const { analyze, LANGUAGES } = require('./engine');
require('./rules');                       // loads every rule set

const SEVERITY = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  info: vscode.DiagnosticSeverity.Information,
};

function toDiagnostic(issue) {
  const range = new vscode.Range(issue.line, issue.start, issue.line, issue.end);
  const d = new vscode.Diagnostic(range, issue.message, SEVERITY[issue.severity] || SEVERITY.warning);
  d.source = 'Code Medic';
  d.code = issue.rule;
  return d;
}

function activate(context) {
  const collection = vscode.languages.createDiagnosticCollection('code-medic');
  const timers = new Map();

  const check = (doc) => {
    if (!LANGUAGES[doc.languageId]) return;
    collection.set(doc.uri, analyze(doc.getText(), doc.languageId).map(toDiagnostic));
  };
  // Wait until typing pauses for 300 ms before checking, so big files stay responsive.
  const checkSoon = (doc) => {
    clearTimeout(timers.get(doc.uri.toString()));
    timers.set(doc.uri.toString(), setTimeout(() => check(doc), 300));
  };

  context.subscriptions.push(
    collection,
    vscode.workspace.onDidOpenTextDocument(check),
    vscode.workspace.onDidChangeTextDocument((e) => checkSoon(e.document)),
    vscode.workspace.onDidCloseTextDocument((doc) => collection.delete(doc.uri)),
    vscode.commands.registerCommand('codeMedic.checkFile', () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) check(editor.document);
    }),
  );
  vscode.workspace.textDocuments.forEach(check);
}

function deactivate() {}

module.exports = { activate, deactivate };
