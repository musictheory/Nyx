/*
    Compiler.js
    (c) 2013-2025 musictheory.net, LLC
    MIT license, http://www.opensource.org/licenses/mit-license.php
*/


import fs   from "node:fs/promises";
import path from "node:path";

import { Builder        } from "./Builder.js";
import { FunctionMapper } from "./FunctionMapper.js";
import { Generator      } from "./Generator.js";
import { Parser         } from "./ast/Parser.js";
import { ScopeManager   } from "./ScopeManager.js";
import { SourceMapper   } from "./SourceMapper.js";
import { Squeezer       } from "./Squeezer.js";
import { Syntax         } from "./ast/Tree.js";
import { Utils          } from "./Utils.js";

import { CompileCallbackFile   } from "./model/CompileCallbackFile.js";
import { CompilerFile          } from "./model/CompilerFile.js";
import { CompilerIssue         } from "./model/CompilerIssue.js";
import { CompilerOptions       } from "./model/CompilerOptions.js";
import { Model                 } from "./model/Model.js";

import { Typechecker           } from "./typechecker/Typechecker.js";

const Log = Utils.log;


export class Compiler {


constructor()
{
    this._files   = [ ];
    this._defs    = [ ];
    this._options = { };

    this._model   = null;   
    this._parents = [ ];
    this._checker = null;
}


_makeFiles(optionsFiles, previousFiles)
{
    let existingMap = new Map();
    let outFiles = [ ];

    for (let file of previousFiles) {
        existingMap.set(file.path, file);
    }

    for (let { path, contents, time } of optionsFiles) {
        let file = existingMap.get(path) ?? new CompilerFile(path);

        if (contents) {
            if (!time) time = Date.now();
            file.updateWithContentsAndTime(contents, time);
        } else {
            file.updateFromDisk();
        }

        outFiles.push(file);
    }

    return outFiles;
}


_throwErrorInFiles(files)
{
    for (let file of files) {
        if (file.error) {
            throw file.error;
        }
    }
}


async _preprocessFiles(files, options)
{
    let beforeCompileCallback = options["before-compile"];

    files = files.filter(file => file.needsPreprocess);

    if (!beforeCompileCallback) {
        for (let file of files) {
            file.needsPreprocess = false;
        }

        return;
    }

    await Promise.all(files.map(async file => {
        let lines    = file.contents.split("\n");
        let warnings = [ ];

        let callbackFile = new CompileCallbackFile(file.path, lines, warnings);

        try {
            await beforeCompileCallback(callbackFile);
            file.contents = callbackFile._lines.join("\n");

            file.needsPreprocess = false;

        } catch (err) {
            Log(`${file.path} needsPreprocess due to error: '${err}'`);
            file.error = err;
        }
    }));

    this._throwErrorInFiles(files);
}


async _parseFiles(files)
{
    await Promise.all(files.map(async file => {
        if (!file.ast) {
            Log(`Parsing ${file.path}`);

            try { 
                file.ast = Parser.parse(file.contents);
                file.needsGenerate();

            } catch (inError) {
                let message = inError.description || inError.toString();
                message = message.replace(/$.*Line:/, "");

                file.needsParse();
                file.error = new CompilerIssue(message, {
                    line:   inError.loc?.line,
                    column: inError.loc?.column
                });
                
                file.error.cause = inError;
            }
        }
    }));

    this._throwErrorInFiles(files);
}


async _buildFiles(files, model)
{
    await Promise.all(files.map(async file => {
        try {
            if (!file.builder) {
                let builder = new Builder(file);
                builder.build();
                file.builder = builder;
            }

            file.builder.addToModel(model);

        } catch (err) {
            file.needsParse();
            file.error = err;
        }
    }));

    this._throwErrorInFiles(files);
}


async _fillImports(inOutFiles, model)
{
    let pastPaths = [ ];
    let filePaths = inOutFiles.map(f => f.path);

    for (let file of inOutFiles) {
        let importMap = new Map();

        for (let importName of file.imports) {
            let object = model.get(importName);
            if (!object) continue;
            
            if (object instanceof Model.Runtime) {
                importMap.set(importName, { object: object, importType: ScopeManager.ImportType.Past });

            } else {
                let path = object.location.path;
                let importType = ScopeManager.ImportType.Past;

                if (path && filePaths.includes(path) && !pastPaths.includes(path)) {
                    importType = ScopeManager.ImportType.Future;
                }

                importMap.set(importName, { object: object, importType: importType });
            }
        }
        
        file.scopeManager.finish(importMap);

        pastPaths.push(file.path);
    }
}


async _reorderFiles(inOutFiles, model)
{
    let nameToDependentsMap = new Map();

    let addedFiles = new Set();
    let visitedFiles = new Set();
    let outFiles = [ ];

    for (let file of inOutFiles) {
        let imports = file.imports;
        let scopeManager = file.scopeManager;
        
        scopeManager.reset();
        
        for (let declaration of scopeManager.getTopLevelDeclarations()) {
            let superClassName = declaration?.object?.superClassName;

            if (superClassName && (imports.indexOf(superClassName) >= 0)) {
                let set = nameToDependentsMap.get(superClassName) ?? new Set();
                set.add(file);
                nameToDependentsMap.set(superClassName, set);            
            }
        }
    }

    // console.log("--- nameToDependentsMap");
    // for (let key of nameToDependentsMap.keys()) {
    //     console.log(`${key} -> [`);
    //     console.log(Array.from(nameToDependentsMap.get(key)).map(f => f.path).join(",\n"));
    //     console.log(`]`);
    // }
    // console.log("---");
    
    function sort(toSort, reference, direction = 1) {
        toSort.sort((a, b) => {
            let aIndex = reference.indexOf(a);
            let bIndex = reference.indexOf(b);

            return (aIndex - bIndex) * direction;
        });
        
        return toSort;
    }
    
    function visit(file) {
        if (addedFiles.has(file)) {
            return;
        }
        
        addedFiles.add(file);

        for (let exportName of file.exports) {
            let dependents = nameToDependentsMap.get(exportName) || new Set();
            
            for (let dependent of dependents) {
                visit(dependent);
            }
        }
        
        outFiles.unshift(file);
    }
    
    for (let file of inOutFiles.toReversed()) {
        visit(file);
    }
    
    sort(inOutFiles, outFiles, 1);
}


async _generateJavaScript(files, model, squeezer, options)
{
    let afterCompileCallback = options["after-compile"];

    await Promise.all(files.map(async file => {
        try {
            if (!file.generatedLines) {
                Log(`Generating ${file.path}`);

                let generator = new Generator(file, model, squeezer, options);
                let result    = generator.generate();

                file.generatedLines    = result.lines;
                file.generatedWarnings = result.warnings || [ ];

                if (afterCompileCallback) {
                    let callbackFile = new CompileCallbackFile(file.path, file.generatedLines, file.generatedWarnings);

                    await afterCompileCallback(callbackFile);

                    file.generatedLines    = callbackFile._lines;
                    file.generatedWarnings = callbackFile._warnings;
                }
            }

        } catch (err) {
            Log(`${file.path} needsGenerate due to error: '${err}'`);

            file.needsGenerate();
            file.error = err;
        }
    }));

    this._throwErrorInFiles(files);
}


async _finish(files, options)
{
    function getLines(arrayOrString) {
        if (Array.isArray(arrayOrString)) {
            return arrayOrString.flat(Infinity).join("\n").split("\n");
        } else if (typeof arrayOrString == "string") {
            return arrayOrString.split("\n");
        } else {
            return [ ];
        }
    }
    
    async function getLinesFromProjectFile(inPath) {
        let path = Utils.getProjectPath(inPath);
        return (await fs.readFile(path)).toString().split("\n");
    }

    let prependLines = getLines( options["prepend"] );
    let appendLines  = getLines( options["append"] );

    // Add runtime if needed
    if (!options["dev-omit-runtime"]) {
        if (this._parents.length == 0) {
            prependLines.push(...await getLinesFromProjectFile("lib/runtime.js"));
        }

        if (options["undefined-guards"].size > 0) {
            prependLines.push(...await getLinesFromProjectFile("lib/runtimeExtGuards.js"));
        }
    }
    
    // Add root variable and top-level IIFE
    {
        prependLines.push(
            `(function() { "use strict";`,
            `const N$$_ = globalThis[Symbol.for("__N$$__")];`
        );
        
        appendLines.splice(0, 0,
            `})();`        
        );
    }

    let outputSourceMap   = null;
    let outputFunctionMap = null;

    if (options["include-map"]) {
        let mapper = new SourceMapper(options["source-map-file"], options["source-map-root"]);

        mapper.add(null, prependLines);

        for (let file of files) {
            mapper.add(file.path, file.generatedLines);
        }
        
        mapper.add(null, appendLines);

        outputSourceMap = mapper.getSourceMap();
    }

    //!private: 'include-function-map' is for our internal use
    /* node:coverage disable */
    if (options["include-function-map"]) {
        let functionMaps = { };

        for (let file of files) {
            let mapper = new FunctionMapper(file);
            functionMaps[file.path] = mapper.map();
        }

        outputFunctionMap = functionMaps;
    }
    /* node:coverage enable */

    let outputCode = null;
    {
        let linesArray = [ ];   // Array<Array<String>>

        linesArray.push(prependLines);
        files.forEach(file => linesArray.push(file.generatedLines));
        linesArray.push(appendLines);

        outputCode = Array.prototype.concat.apply([ ], linesArray).join("\n");
    }

    return {
        code: outputCode,
        map:  outputSourceMap,
        functionMap: outputFunctionMap
    };
}


uses(compiler)
{
    this._parents.push(compiler);
}


async collectTypecheckerWarnings()
{
    return this._checker?.collectWarnings();
}


async compile(inOptions)
{
    let previousFiles   = this._files;
    let previousDefs    = this._defs;
    let previousOptions = this._options;
    let previousModel   = this._model;

    let options = new CompilerOptions(inOptions);

    //!legacy: 'include-bridged' option goes away
    let optionsIncludeBridged = options["include-bridged"];

    if (options["dev-print-log"]) {
        Utils.enableLog();
    }

    let files = this._makeFiles(options["files"], previousFiles);
    let defs  = this._makeFiles(options["defs"],  previousDefs);

    let optionsCheckTypes     = options["check-types"];
    let optionsOutputLanguage = options["output-language"];

    // If remaining options changed, invalidate everything
    //
    if (!options.allowsIncrementalCompile(this._options)) {
        previousOptions = options;
        previousModel   = new Model();

        Log("Calling needsAll() on all files");

        for (let file of files) {
            file.needsAll();
        }
    }

    let parentModels    = [ ];
    let parentSqueezers = [ ];
    let parentCheckers  = [ ];

    for (let parent of this._parents) {
        if (parent._model)    parentModels.push(parent._model);
        if (parent._squeezer) parentSqueezers.push(parent._squeezer);
        if (parent._checker)  parentCheckers.push(parent._checker);
        
        options.assertParentCompatibility(parent._options);
    }

    if (optionsCheckTypes && !this._checker) {
        this._checker = new Typechecker(parentCheckers, options);
    }

    let model = new Model(parentModels);
    let squeezer = null;

    if (options["squeeze"]) {
        squeezer = new Squeezer(
            parentSqueezers,
            options["squeeze-start-index"],
            options["squeeze-end-index"],
            options["squeeze-builtins"]
        );
    }
    
    this._files   = files;
    this._options = options;
    this._defs    = defs;

    let outputCode          = null;
    let outputSourceMap     = null;
    let outputFunctionMap   = null;
    let typecheckerWarnings = null;

    let caughtError = null;

    try {
        // Clear errors from last compile
        files.forEach(file => { file.error = null; });

        // Preprocess files
        await this._preprocessFiles(files, options);

        // Parse files
        await this._parseFiles(files);

        // Build model
        await this._buildFiles(files, model, squeezer);

        // Reorder files based on inheritance
        await this._reorderFiles(files, model);

        // Fill imports with model objects
        await this._fillImports(files, model);

        // Perform model diff
        if (!previousModel || previousModel.hasGlobalChanges(model)) {
            if (!previousModel) {
                Log("No previous model, all files need generate");
            } else {
                Log("Model has global changes, all files need generate");
            }

            files.forEach(file => file.needsGenerate());
        }

        // If we get here, our current model is valid.  Save it for next time
        this._model = model;
        this._squeezer = squeezer;

        // Run typechecker
        if (optionsCheckTypes) {
            this._checker.check(model, squeezer, defs, files);

            if (Typechecker.includeInCompileResults) {
                typecheckerWarnings = await this._checker.collectWarnings();
            }
        }

        // Run generator
        if (optionsOutputLanguage != "none") {
            await this._generateJavaScript(files, model, squeezer, options);
        }

        // Concatenate and map output
        if (optionsOutputLanguage != "none") {
            let results = await this._finish(files, options);

            if (results) {
                outputCode        = results.code;
                outputSourceMap   = results.map;
                outputFunctionMap = results.functionMap;
            }
        }

    } catch (err) {
        caughtError = err;
    }

    let errors = files.map(file => file.error).filter(error => !!error);

    if (caughtError && !errors.includes(caughtError)) {
        errors.unshift(caughtError);
    }
    
    for (let error of errors) {
        if (!error instanceof CompilerIssue) {
            throw error;
        }
    }

    let warnings = files
        .map(file => file.generatedWarnings)
        .concat(typecheckerWarnings)
        .flat(Infinity)
        .filter(w => !!w);

    let result = {
        code:        outputCode,
        map:         outputSourceMap,
        functionMap: outputFunctionMap,
        errors:      errors,
        warnings:    warnings
    };

    if (options["squeeze"]) {
        result.squeezed = squeezer.getSqueezeMap();
    }

    //!legacy: 'include-bridged' option goes away
    /* node:coverage ignore next 3 */
    if (optionsIncludeBridged) {
        result.bridged = model.saveBridged();
    }

    return result;
}

}

