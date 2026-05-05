import * as vscode from "vscode";

export class EntryNode {
    /** @type {vscode.Uri} */
    uri;
    /** @type {vscode.FileType} */
    type;

    constructor(uri, type) {
        this.uri = uri;
        this.type = type;
    }
}
