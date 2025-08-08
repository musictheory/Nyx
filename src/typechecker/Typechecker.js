/*
    Typechecker.js
    (c) 2013-2025 musictheory.net, LLC
    MIT license, http://www.opensource.org/licenses/mit-license.php

    Main implementation of type checking, wraps parallel instances of TypeWorker.
*/

import fs   from "node:fs";
import path from "node:path";

import { CompilerIssue } from "../model/CompilerIssue.js";
import { Generator     } from "../Generator.js";
import { SymbolUtils   } from "../SymbolUtils.js";
import { TypeWorker    } from "./TypeWorker.js";
import { Utils         } from "../Utils.js";


let sNextCheckerID = 1;
let sNextGroupID = 1;
let sWorkerCount = 4;
let sWorkers;

let sRuntimeDefsContents;

let sDidRemoveDebugDirectory = false;

const DefsSuffix = "defs.d.ts";

const RuntimeDefsKey   = `N$-runtime${path.sep}${DefsSuffix}`;


export function tuneTypecheckerPerformance(includeInCompileResults, workerCount)
{
    if (sWorkers) {
        throw new Error("tuneTypecheckerPerformance() must be called before any call to compile()");
    }
    
    Typechecker.includeInCompileResults = includeInCompileResults;
    sWorkerCount = (workerCount > 0) ? workerCount : 4;
}


export class Typechecker {

static includeInCompileResults = true;


constructor(parents, options)
{
    if (!sWorkers) {
        sWorkers = [ ];

        for (let i = 0; i < sWorkerCount; i++) {
            sWorkers.push(new TypeWorker());
        }
    }

    
    this._checkerID = sNextCheckerID++;
    this._groupID = parents?.[0]?._groupID ?? sNextGroupID++;
    this._parents = parents;
    this._options = options;
    this._nextWorkerIndex = 0;
    this._defsMap = new Map();
    this._codeMap = new Map();

    this._generatorOptions = {
        "output-language": "typechecker",
        "additional-globals": options["additional-globals"],
        "observers": options["observers"]
    };
    
    let tsTarget = options["typescript-target"] ?? "es2022";

    let tsLib = options["typescript-lib"];
    if (!tsLib.length) tsLib = [ "es2022" ];
    
    let tsOptions = {
        noImplicitAny: true,
        noImplicitReturns: true,
        noImplicitThis: true,
        strictNullChecks: true,
        strictBindCallApply: true,
        strictBuiltinIteratorReturn: true,
        strictFunctionTypes: true,
        useUnknownInCatchVariables: true,

        // Conflicts with init-based initialization due to TypeScript's
        // lack of control flow analysis. See Issue #59997
        strictPropertyInitialization: false,

        // Nyx may generate unreachable TypeScript code due to Target Tags
        // or other features.
        allowUnreachableCode: true
    };
    
    // Allow clients to override the above options
    tsOptions = Object.assign(tsOptions, options["typescript-options"] ?? { });
    
    tsOptions = Object.assign(tsOptions, {
        target: tsTarget,
        lib:    tsLib,

        allowArbitraryExtensions: true,
        allowImportingTsExtensions: true,
        module: "bundler",
        moduleResolution: "bundler"
    });

    // Internal options
    if (options["dev-fast-test"]) {
        tsOptions = { "dev-fast-test": true };
    }
    
    for (let i = 0; i < sWorkerCount; i++) {
        sWorkers[i].prepare(this._checkerID, this._groupID, tsOptions);
    }
}


// For internal development
/* node:coverage disable */
_writeDebugInformation()
{
    let debugTmp = "/tmp/nilscript.typechecker";
    let usedPaths = new Set();

    function formatKey(key) {
        let result = key.replaceAll(/[ /]/g, "_");

        while (usedPaths.has(result)) {
            result = "_" + result;
        }

        usedPaths.add(result);
               
        return result;
    }

    if (!sDidRemoveDebugDirectory) {
        fs.rmSync(debugTmp, { recursive: true, force: true });
        sDidRemoveDebugDirectory = true;
    }
    
    let basePath = debugTmp + path.sep + this._checkerID;
    let codePath = basePath + path.sep + "code";
    let defsPath = basePath + path.sep + "defs";
    
    fs.mkdirSync(codePath, { recursive: true });
    fs.mkdirSync(defsPath, { recursive: true });

    for (let [ key, entry ] of this._defsMap) {
        fs.writeFileSync(defsPath + path.sep + formatKey(key), entry.contents);
    }
    
    for (let [ key, entry ] of this._codeMap) {
        fs.writeFileSync(codePath + path.sep + formatKey(key), entry.contents);
    }
}
/* node:coverage enable */



_updateEntry(previous, inVersion, callback)
{
    let entry = {
        file:      previous.file,
        contents:  previous.contents  ?? null,
        inVersion: previous.inVersion ?? NaN,
        version:   previous.version   ?? 1
    };

    if (entry.inVersion != inVersion) {
        let contents = callback();

        if (contents != entry.contents) {
            entry.contents = contents;
            entry.version++;                
        }
        
        entry.inVersion = inVersion;
    }
    
    return entry;
}


_updateDefs(inModel, inSqueezer, inDefs, inFiles)
{
    let previousDefsMap = this._defsMap;
    let defsMap = new Map();
    
    for (let parent of this._parents) {
        for (let [ key, value ] of parent._defsMap) {
            defsMap.set(key, value);
        }
    }

    for (let inFile of (inDefs ?? [ ])) {
        let defsKey = inFile.path + path.sep + DefsSuffix;

        defsMap.set(defsKey, {
            file: defsKey,
            contents: inFile.contents,
            version: inFile.generatedVersion,
            original: inFile.path
        });
    }

    // Make entry for runtime.d.ts
    {
        if (!sRuntimeDefsContents) {
            let runtimeDefsFile = Utils.getProjectPath("lib/runtime.d.ts");
            sRuntimeDefsContents = fs.readFileSync(runtimeDefsFile) + "\n";
        }
        
        defsMap.set(RuntimeDefsKey, {
            file: RuntimeDefsKey,
            contents: sRuntimeDefsContents,
            version: 0
        });
    }

    this._defsMap = defsMap;
}
 

_updateCode(inModel, inSqueezer, inFiles)
{
    let previousCodeMap = this._codeMap;
    let codeMap = new Map();

    for (let parent of this._parents) {
        for (let [ key, value ] of parent._codeMap) {
            let clonedValue = structuredClone(value);
            clonedValue.workerIndex = NaN;
            codeMap.set(key, clonedValue);
        }
    }

    for (let inFile of inFiles) {
        let codeKey = path.normalize(inFile.path + ".ts");

        let previous = previousCodeMap.get(codeKey);
        if (!previous) previous = { file: codeKey };
        
        let entry = this._updateEntry(previous, inFile.generatedVersion, () => {
            try {
                let generator = new Generator(inFile, inModel, inSqueezer, this._generatorOptions);
                return generator.generate().lines.join("\n");
            } catch (err) {
                inFile.error = err;            
                throw err;
            }
        });

        let workerIndex = previous.workerIndex;
        
        if (workerIndex === undefined) {
            workerIndex = this._nextWorkerIndex;
            this._nextWorkerIndex = (workerIndex + 1) % sWorkerCount;
        }

        entry.workerIndex = workerIndex;
        entry.original = inFile.path;

        codeMap.set(codeKey, entry);
    }

    this._codeMap = codeMap;
}


_getWarnings(diagnostics, squeezer)
{
    let warnings = [ ];

    for (let diagnostic of diagnostics) {
        let { fileName, line, column, code, reason } = diagnostic;
        if (!fileName) continue;

        fileName = this._codeMap.get(fileName)?.original ??
                   this._defsMap.get(fileName)?.original ??
                   fileName;

        if (!fileName) continue;

        // Symbolicate reason string and remove ending colon/period
        reason = SymbolUtils.symbolicate(reason, squeezer).replace(/[\:\.]$/, "");

        let issue = new CompilerIssue(reason, {  line, column });
        issue.addFile(fileName);
        issue.code = code;
        issue.typechecker = true;

        warnings.push(issue);
    }

    return warnings;
}


_makeWorkerArgsArray(inModel)
{
    let code = Array.from(this._codeMap.values());
    let defs = Array.from(this._defsMap.values());

    return sWorkers.map((unused, index) => {
        let entriesToCheck = code.filter(entry => (entry.workerIndex == index));

        return {
            entries: [ ...code, ...defs ],
            active: entriesToCheck.map(entry => entry.file)
        }
    });
}


check(model, squeezer, defs, files)
{
    let options     = this._options;
    let development = options["dev-dump-tmp"];

    this._updateDefs(model, squeezer, defs, files);
    this._updateCode(model, squeezer, files);
    
    if (development) {
        this._writeDebugInformation();
    }

    this._warningsPromise = (async () => {
        await Promise.all(this._parents.map(parent => parent.collectWarnings()));
    
        let workerArgsArray = this._makeWorkerArgsArray(model);

        let diagnostics = await Promise.all(workerArgsArray.map((args, index) => {
            let worker = sWorkers[index];
            return worker.work(this._checkerID, args.entries, args.active);
        }))

        return this._getWarnings(diagnostics.flat(), squeezer);
    })();
}


async collectWarnings()
{
    return this._warningsPromise;
}


}
