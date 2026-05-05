// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { FileSelectorProvider } from "./fileSelector.js";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
export function activate(context) {
    const provider = new FileSelectorProvider();
    const treeView = vscode.window.createTreeView("verba.fileSelector", {
        treeDataProvider: provider,
        manageCheckboxStateManually: true,
    });
    treeView.onDidChangeCheckboxState(async (event) => {
        for (const [entryNode, checkState] of event.items) {
            const checked = checkState === vscode.TreeItemCheckboxState.Checked;
            await provider.cascade(entryNode.uri, entryNode.type, checked);
        }
        provider.refresh();
    });
    // 把 treeView 加入 context 订阅，以便在插件停用时，
    // 由 vscode 自动清理，以免造成内存溢出。
    context.subscriptions.push(treeView);
}

// This method is called when your extension is deactivated
export function deactivate() {}
