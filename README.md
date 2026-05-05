# vscode-treeview-file-picker

A VS Code extension starter for building a **workspace file selector using the native TreeView API** — with checkboxes, cascade selection, glob filtering, and theme-aware icons.

If you've ever needed a multi-file picker inside a VS Code sidebar panel, this is the foundation you wish existed when you started.

---

## Why this exists

The VS Code TreeView API is powerful but under-documented, especially around checkboxes. Building a production-ready file selector requires solving a series of non-obvious problems:

- Checkbox state is **not managed by VS Code** when `manageCheckboxStateManually: true` — you own the state
- Node instances are **recreated on every refresh** — storing state on the instance will silently lose it
- Cascade selection (parent → children, children → parent) must be **implemented manually**
- TreeView nodes need a **stable `id`** to preserve expand/collapse state across refreshes
- The file system API should use **`vscode.workspace.fs`** (not Node's `fs`) for remote development compatibility

This starter has already solved all of the above.

---

## What's included

- ✅ Sidebar panel with a custom Activity Bar icon
- ✅ File tree using the native VS Code TreeView API
- ✅ Multi-select with native checkboxes
- ✅ Cascade selection: check a directory → all visible children get checked
- ✅ Reverse cascade: check all children → parent gets checked automatically
- ✅ Glob-based `include` / `exclude` / `collapse` configuration via VS Code settings
- ✅ File icons that follow the user's active file icon theme
- ✅ Compatible with remote development (SSH, WSL, Dev Containers)
- ✅ Modern JavaScript: ESM, private class fields (`#`), ES2022 class field declarations
- ✅ No unnecessary dependencies — only [`picomatch`](https://github.com/micromatch/picomatch) for glob matching

---

## Known limitations & design decisions

### No indeterminate (partial) checkbox state

VS Code's `TreeItemCheckboxState` only supports two values: `Checked` and `Unchecked`. There is no native indeterminate (`—`) state.

**Our decision:** A directory with only some children checked displays as `Unchecked`. Only when all visible children are checked does the directory show as `Checked`. This is consistent and predictable, even if it diverges from typical tri-state checkbox behavior.

### Single-click on a directory node selects it, not expands it

When a TreeItem has a `checkboxState`, VS Code changes the single-click behavior on the row label from "expand/collapse" to "select node". Expanding still works via the arrow icon or double-click.

This is a known VS Code TreeView limitation with no API workaround. A future Webview-based implementation would eliminate this constraint.

### Cascade only applies to visible entries

Entries excluded by your `verba.exclude` glob patterns are not included in cascade operations. What you see is what gets checked.

---

## Configuration

All settings are workspace-scoped and can be set in `.vscode/settings.json`:

```json
{
    "verba.include": ["**/*"],
    "verba.exclude": [
        "**/.git/",
        "**/node_modules/",
        "**/dist/",
        "**/build/",
        "**/.vscode/",
        "**/*.vsix"
    ],
    "verba.collapse": []
}
```

| Setting          | Default       | Description                                                                    |
| ---------------- | ------------- | ------------------------------------------------------------------------------ |
| `verba.include`  | `["**/*"]`    | Glob patterns for files to show. Acts as the primary whitelist.                |
| `verba.exclude`  | _(see above)_ | Glob patterns to hide from the tree. Applied after `include`.                  |
| `verba.collapse` | `[]`          | Glob patterns for directories to collapse by default. Everything else expands. |

**Priority order:** `include` sets the scope → `exclude` removes from scope → `collapse` controls expand state.

---

## How to use this starter

1. **Fork** this repository
2. **Rename** the extension: update `name`, `publisher`, `displayName` in `package.json`
3. **Replace** the Activity Bar icon at `assets/panel-icon.svg` with your own
4. **Update** the `contributes.viewsContainers` and `contributes.views` IDs in `package.json` to match your extension name
5. **Implement** your action in `extension.js` — call `provider.getCheckedUris()` to retrieve the list of selected files, then do whatever you need with them

```javascript
// Example: get all checked file URIs
const checkedUris = provider.getCheckedUris();
```

---

## Architecture overview

```
extension.js              — activation, TreeView registration, event wiring
src/
  fileSelector.js         — FileSelectorProvider (TreeDataProvider implementation)
  entryNode.js            — EntryNode data model (uri + type)
assets/
  panel-icon.svg          — Activity Bar icon
```

### Key design decisions

| Decision                                                        | Reason                                                                                                      |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| State stored in `#checkedUris` (a `Set`), not on node instances | Node instances are recreated on every `getChildren` call                                                    |
| `TreeItem.id = entry.uri.toString()`                            | Stable ID lets VS Code preserve expand/collapse state across refreshes                                      |
| `manageCheckboxStateManually: true`                             | VS Code's automatic cascade only works for already-loaded nodes; collapsed directories are silently skipped |
| `vscode.workspace.fs` instead of Node's `fs`                    | Works in remote development environments (SSH, WSL, Dev Containers)                                         |
| `picomatch` for glob matching                                   | Zero dependencies, actively maintained, used internally by major tools                                      |

---

## Requirements

- VS Code 1.73 or later (native checkbox API)
- Node.js 18 or later

---

## License

MIT — fork freely.

---

_Built by [@krave1986](https://github.com/krave1986)_
