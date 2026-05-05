import * as vscode from "vscode";
import { FileSelectorProvider } from "./fileSelector.js";

/**
 * Called when the extension is activated.
 * @param {vscode.ExtensionContext} context
 */
export function activate(context) {
    const provider = new FileSelectorProvider();
    const treeView = vscode.window.createTreeView("tvfp.fileSelector", {
        treeDataProvider: provider,
        // Disable VS Code's automatic checkbox cascade — it only works for
        // already-loaded nodes and silently skips collapsed directories.
        // We manage cascade logic manually to ensure consistent behavior.
        manageCheckboxStateManually: true,
    });

    treeView.onDidChangeCheckboxState(async (event) => {
        for (const [entryNode, checkState] of event.items) {
            const checked = checkState === vscode.TreeItemCheckboxState.Checked;
            await provider.cascade(entryNode.uri, entryNode.type, checked);
        }
        // Refresh the entire tree once after all cascade operations are complete.
        provider.refresh();
    });

    // Register the TreeView with the extension context so VS Code can
    // dispose of it automatically when the extension is deactivated.
    context.subscriptions.push(treeView);
}

// Called when the extension is deactivated.
export function deactivate() {}
