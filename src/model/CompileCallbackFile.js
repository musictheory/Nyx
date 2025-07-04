/*
    CompileCallbackFile.js
    (c) 2013-2025 musictheory.net, LLC
    MIT license, http://www.opensource.org/licenses/mit-license.php

    Used in the Compiler API's "before-compile" and "after-compile" callbacks.
*/

import { CompilerIssue } from "./CompilerIssue.js";


export class CompileCallbackFile {


constructor(path, lines, warnings)
{
    this._path     = path;
    this._lines    = lines || [ ];
    this._warnings = warnings || [ ];
}


setContents(contents)
{
    let oldLines = this._lines;
    let newLines = contents ? contents.split("\n") : [ ];

    if (newLines.length > oldLines.length) {
        throw new Error(`Line count mismatch: ${newLines.length} vs. ${oldLines.length}`);
    }

    // Insert newlines, as babel likes to trim the end
    while (newLines.length < oldLines.length) {
        newLines.push("");
    }

    this._lines = newLines;
}


getContents()
{
    return this._lines ? this._lines.join("\n") : "";
}


getPath()
{
    return this._path;
}


addWarning(line, message)
{
    let warning = new CompilerIssue(message, line);
    warning.addFile(this._path);
    this._warnings.push(warning);
}


}
