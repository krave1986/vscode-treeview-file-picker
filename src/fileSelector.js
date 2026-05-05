import picomatch from "picomatch";
import * as vscode from "vscode";
import { EntryNode } from "./entryNode.js";

export class FileSelectorProvider {
    // Reads the tvfp configuration from VS Code settings.
    // include: primary whitelist — defines which files should be visible
    // exclude: secondary blacklist — removes files from the whitelist
    // collapse: determines which directories are collapsed by default (everything else expands)
    #getConfig() {
        const config = vscode.workspace.getConfiguration("tvfp");
        return {
            included: config.get("include"),
            excluded: config.get("exclude"),
            collapsed: config.get("collapse"),
        };
    }

    // Builds a TreeItem from an EntryNode.
    // A TreeItem can be thought of as an EntryNode with UI state attached.
    #buildTreeItem(entry, collapsibleState) {
        const entryLabel = entry.uri.path.split("/").at(-1);
        const item = new vscode.TreeItem(entryLabel, collapsibleState);
        // Set a stable id so VS Code can preserve expand/collapse state across refreshes.
        item.id = entry.uri.toString();
        item.resourceUri = entry.uri;
        // Derive checkbox state from #checkedUris — the single source of truth.
        item.checkboxState = this.#checkedUris.has(item.id)
            ? vscode.TreeItemCheckboxState.Checked
            : vscode.TreeItemCheckboxState.Unchecked;
        return item;
    }

    // Stores the URIs of all checked entries.
    #checkedUris = new Set();

    // Marks an entry as checked.
    check(uriString) {
        this.#checkedUris.add(uriString);
    }

    // Marks an entry as unchecked.
    uncheck(uriString) {
        this.#checkedUris.delete(uriString);
    }

    // All entry parameters here are EntryNode instances.
    // VS Code calls getTreeItem for each EntryNode returned by getChildren,
    // establishing a one-to-one mapping between data and view.
    getTreeItem(entry) {
        // Files have no expand/collapse concept — return immediately.
        if (entry.type !== vscode.FileType.Directory) {
            return this.#buildTreeItem(
                entry,
                vscode.TreeItemCollapsibleState.None,
            );
        }

        // Directory entry handling below.

        // rootUri is guaranteed to exist here —
        // ensured by the early return in getChildren(): `if (!folder) return []`
        const rootUri = this.#getRootUri();

        // Compute the path relative to the workspace root, with a trailing "/"
        // to match directory glob patterns (e.g. src/time/).
        //
        // slice(start) returns the substring starting at the given index.
        // Since indices are zero-based, rootUri.path.length points to the
        // character just after the workspace root — adding 1 skips the slash,
        // giving us the first character of the relative path.
        const relativePath =
            entry.uri.path.slice(rootUri.path.length + 1) + "/";

        const { collapsed } = this.#getConfig();
        const isCollapsed = picomatch(collapsed);

        // Default to expanded; collapsed is an opt-in exception list.
        return this.#buildTreeItem(
            entry,
            isCollapsed(relativePath)
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.Expanded,
        );
    }

    #getRootUri() {
        // @ts-ignore — workspaceFolders is guaranteed to exist by our business logic.
        return vscode.workspace.workspaceFolders[0].uri;
    }

    // All entry parameters (except the workspace root) are EntryNode instances.
    async getChildren(entry) {
        if (!entry) {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (!folder) return [];
            // Root node: wrap the workspace root as a plain object
            // so the rest of the method can handle it uniformly.
            entry = { uri: folder.uri };
        }

        const entries = await this.#readEntries(entry.uri);

        // entries is an array of [name, type] tuples.
        // name: the entry name only — no path prefix.
        // type: a vscode.FileType enum value:
        //   1 → vscode.FileType.File
        //   2 → vscode.FileType.Directory
        const filtered = this.#filterEntries(entries);

        filtered.sort(([nameA, typeA], [nameB, typeB]) => {
            if (typeA !== typeB) {
                return typeA === vscode.FileType.Directory ? -1 : 1;
            }
            return nameA.localeCompare(nameB);
        });

        return filtered.map(
            ([name, type]) =>
                new EntryNode(vscode.Uri.joinPath(entry.uri, name), type),
        );
    }

    #emitter = new vscode.EventEmitter();

    // VS Code defines the onDidChangeTreeData event type internally.
    // By assigning this.#emitter.event to onDidChangeTreeData, we tell VS Code:
    // "this emitter represents that event — handle it accordingly when fired."
    onDidChangeTreeData = this.#emitter.event;

    // Filters raw directory entries using the include/exclude configuration.
    // include sets the scope; exclude removes entries from that scope.
    // The filtered result contains only entries that should be visible in the panel.
    #filterEntries(entries) {
        const { included, excluded } = this.#getConfig();
        const isIncluded = picomatch(included);
        const isExcluded = picomatch(excluded);
        return entries.filter(([name, type]) => {
            const testPath =
                type === vscode.FileType.Directory ? name + "/" : name;
            return isIncluded(testPath) && !isExcluded(testPath);
        });
    }

    async #readEntries(uri) {
        return vscode.workspace.fs.readDirectory(uri);
    }

    // Fires the onDidChangeTreeData event to trigger a re-render.
    // Pass a specific node to refresh only that node; pass nothing to refresh the entire tree.
    refresh(node = undefined) {
        this.#emitter.fire(node);
    }

    // Recursively checks or unchecks all visible descendants of a directory.
    async #cascadeDownward(uri, checked) {
        const entries = this.#filterEntries(await this.#readEntries(uri));
        for (const [name, type] of entries) {
            const childUri = vscode.Uri.joinPath(uri, name);
            checked
                ? this.check(childUri.toString())
                : this.uncheck(childUri.toString());
            if (type === vscode.FileType.Directory) {
                // Must await — ensures #checkedUris is fully populated
                // before the outer caller proceeds to refresh().
                await this.#cascadeDownward(childUri, checked);
            }
        }
    }

    // Walks up the directory tree, updating each ancestor's checked state.
    // propagateUncheckedUpward: when true, all ancestors are unchecked immediately
    // without inspecting their children — short-circuits all remaining readDirectory calls.
    async #cascadeUpward(uri, rootUri, propagateUncheckedUpward) {
        const parentUri = vscode.Uri.joinPath(uri, "..");
        if (parentUri.path === rootUri.path) return;
        if (propagateUncheckedUpward) {
            this.uncheck(parentUri.toString());
        } else {
            const entries = this.#filterEntries(
                await this.#readEntries(parentUri),
            );
            const allChecked = entries.every(([name]) =>
                this.#checkedUris.has(
                    vscode.Uri.joinPath(parentUri, name).toString(),
                ),
            );
            allChecked
                ? this.check(parentUri.toString())
                : this.uncheck(parentUri.toString());
            propagateUncheckedUpward = !allChecked;
        }
        await this.#cascadeUpward(parentUri, rootUri, propagateUncheckedUpward);
    }

    // Public entry point for cascade operations.
    // Checks/unchecks the entry itself, then fans out downward (directories only)
    // and upward (all entries) in parallel.
    async cascade(uri, entryType, checked) {
        checked ? this.check(uri.toString()) : this.uncheck(uri.toString());
        const rootUri = this.#getRootUri();
        await Promise.all([
            entryType === vscode.FileType.Directory
                ? this.#cascadeDownward(uri, checked)
                : Promise.resolve(),
            this.#cascadeUpward(uri, rootUri, !checked),
        ]);
    }

    // Returns the list of all currently checked URIs as an array.
    getCheckedUris() {
        return [...this.#checkedUris];
    }
}
