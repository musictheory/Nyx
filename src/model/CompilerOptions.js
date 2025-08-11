/*
    CompilerOptions.js
    (c) 2025 musictheory.net, LLC
    MIT license, http://www.opensource.org/licenses/mit-license.php
*/


import fs   from "node:fs/promises";
import path from "node:path";

import { Utils } from "../Utils.js";


const sOptions = new Map();

for (let [ key, value ] of Object.entries({
    //
    // Keys:
    //
    // v   Validator function
    // i   If true, option is allowed to change between incremental compiles
    // p   If true, option is private and can only be used if "allow-private-options" is true
    // x   If true, option must be equal to that of a parent compiler
    //

    // Input options
    "files":                     { v: vFilesDefs,     i: true }, // Files to compile
    "prepend":                   { v: vPrependAppend, i: true }, // Content/lines to prepend, not compiled
    "append":                    { v: vPrependAppend, i: true }, // Content/lines to append, not compiled

    // Output options
    "output-language":           { }, // string, Output language ('none' or 'es5' public, 'typechecker' for debugging only)
    "include-map":               { v: vBoolean }, // boolean, include 'map' key in results object
    "source-map-file":           { v: vString  }, // string, Output source map file name
    "source-map-root":           { v: vString  }, // string, Output source map root URL

    "before-compile":            { v: vFunction, i: true }, // Function, callback to call per-file before the nyx->js compile
    "after-compile":             { v: vFunction, i: true }, // Function, callback to call per-file after the nyx->js compile

    // Language Features 
    "interceptors":              { v: vInterceptors      }, // Map<string, Function>, string interceptor functions
    "additional-globals":        { v: vAdditionalGlobals }, // Map<string, string|number|boolean|null>
    "observers":                 { v: vObservers         }, // Map<string, string|number>, prop observers
    "target-tags":               { v: vTargetTags        }, // Map<string, boolean>, target tags
    "undefined-guards":          { v: vUndefinedGuards   }, // Set<string>, enabled undefined guards

    // Squeezer options
    "squeeze":                   { v: vBoolean, x: true }, // Enable squeezer
    "squeeze-start-index":       { v: vInteger          }, // Start index for squeezer
    "squeeze-end-index":         { v: vInteger          }, // End index for squeezer"
    "squeeze-builtins":          { v: vSqueezeBuiltins  }, // List of identifiers to not squeeze

    // Typechecker options
    "check-types":               { v: vBoolean       }, // Enable type checker
    "defs":                      { v: vFilesDefs, i: true }, // Additional typechecker defs
    "typescript-target":         { v: vString        }, // string
    "typescript-lib":            { v: vTypescriptLib }, // string[], specify alternate lib.d.ts file(s)
    "typescript-options":        { }, // Record<string, any> of TypeScript options

    // Development options
    "dev-dump-tmp":              { v: vBoolean }, // dump debug info to /tmp
    "dev-print-log":             { v: vBoolean }, // print log to stdout
    "dev-omit-runtime":          { v: vBoolean }, // omit runtime (for nyxdev.js tool)
    "dev-output-typescript":     { v: vBoolean }, // output typescript code (for nyxdev.js tool)
    "dev-fast-test":             { v: vBoolean }, // set by test runner to skip TypeScript loading

    // Private options
    // These are still used in our internal projects and will eventually go away
    "allow-private-options":     { v: vBoolean },  // Allow use of below options
    "include-bridged":           { v: vBoolean, p: true },
    "include-function-map":      { v: vBoolean, p: true }
})) {
    sOptions.set(key, value);
}


function isEmpty(value)
{
    return value === undefined || value === null;
}


function isString(value)
{
    return typeof value === "string";
}


function isFunction(value)
{
    return typeof value === "function";
}


function isType(value, validTypes)
{
    let type = (value === null) ? "null" : typeof value;
    return validTypes.some(validType => type === validType);
}


function isStringArray(value)
{
    if (Array.isArray(value)) {
        return value.every(x => isString(x));
    }
    
    return false;
}


function isStringSet(value)
{
    if (value instanceof Set) {
        for (let entry of value) {
            if (!isString(entry)) {
                return false;
            }
        }
        
        return true;
    }
}


function vBoolean(key, value)
{
    if (isEmpty(value)) return false;
    if (value === true || value === false) return value;

    throw new Error(`Compiler option '${key}' must be a boolean.`);
}


function vInteger(key, value)
{
    if (isEmpty(value)) return 0;
    if (Number.isInteger(value)) return value;

    throw new Error(`Compiler option '${key}' must be an integer.`);
}


function vString(key, value)
{
    if (isEmpty(value)) return null;
    if (isString(value)) return value;

    throw new Error(`Compiler option '${key}' must be a string.`);
}


function vFunction(key, value)
{
    if (isEmpty(value)) return null;
    if (isFunction(value)) return value;

    throw new Error(`Compiler option '${key}' must be a function.`);
}


function vArrayOrSet(key, value, memberCallback)
{
    let outSet = new Set();
    let iterator;

    if (isEmpty(value)) {
        return outSet;
    }

    if ((value instanceof Set) || Array.isArray(value)) {
        iterator = value.values();
    } else {
        throw new Error(`Compiler option '${key}' must be an array or Set.`);
    }

    for (let member of iterator) {
        outSet.add(memberCallback(member));
    }

    return outSet;
}


function vObjectOrMap(key, value, entryCallback)
{
    let outMap = new Map();
    let iterator;

    if (isEmpty(value)) {
        return outMap;
    }
    
    if (value instanceof Map) {
        iterator = value.entries();
    } else if (!Array.isArray(value) && !(value instanceof Set) && typeof value === "object") {
        iterator = Object.entries(value);
    } else {
        throw new Error(`Compiler option '${key}' must be a Map or object.`);
    }
    
    for (let [ entryKey, entryValue ] of iterator) {
        if (typeof entryKey !== "string") {
            throw new Error(`Compiler option '${key}' must be a Map with string keys.`);
        }

        outMap.set(entryKey, entryCallback(entryKey, entryValue));
    }

    return outMap;
}


// Validator for "files" and "defs"
//
function vFilesDefs(key, value)
{
    if (value === undefined || value === null) {
        return [ ];
    }
    
    if (!Array.isArray(value)) {
        throw new Error(`Compiler option '${key}' must be an array.`);
    }
    
    let outFiles = [ ];

    // The 'files' and 'defs' options can either be an array of file paths,
    // or an array of objects with the following keys:
    //
    //        path: file path 
    //    contents: file contents
    //        time: file modification time
    //
    for (let f of value) {
        let path;
        let contents = null;
        let time = 0;

        if (typeof f == "string") {
            path = f;

        } else if (typeof f?.path == "string") {
            path = f.path;
            
            if (isString(f.contents)) contents = f.contents;
            if (Number.isInteger(f.time)) time = f.time;

        } else {
            throw new Error(`Invalid value for member of compiler option '${key}'.`);
        }

        if (!path) {
            throw new Error(`Each member of compiler option '${key}' must specify a 'path'.`);
        }

        outFiles.push({
            path:     path,
            contents: contents,
            time:     time
        });
    }

    return outFiles;
}


// Validator for "prepend" and "append"
//
function vPrependAppend(key, value)
{
    if (isEmpty(value)) return [ ];
    if (isString(value)) return value.split("\n");
    if (isStringArray(value)) return value;
    
    throw new Error(`Compiler option '${key}' must be a string or an array of strings.`);
}


// Validator for "interceptors"
//
function vInterceptors(key, value)
{
    return vObjectOrMap(key, value, (key, value) => {
        if (typeof value !== "function") {
            throw new Error(`Interceptor '${key}' must be a function.`);
        }
        
        return value;
    });
}


// Validator for "additional-inlines"
//
function vAdditionalGlobals(key, value)
{
    return vObjectOrMap(key, value, (key, value) => {
        if (!isType(value, [ "boolean", "null", "number", "string" ])) {
            throw new Error(`Additional Global '${key}' must be a boolean, null, number, or string.`);
        }

        return value;
    });
}


// Validator for "observers"
//
function vObservers(key, value)
{
    return vObjectOrMap(key, value, (key, value) => {
        if (!isType(value, [ "number", "string" ])) {
            throw new Error(`Observer '${key}' must be a number or string.`);
        }

        return value;
    });
}


// Validator for "target-tags"
//
function vTargetTags(key, value)
{
    return vObjectOrMap(key, value, (key, value) => {
        if (!isType(value, [ "boolean" ])) {
            throw new Error(`Target Tag '${key}' must be a boolean.`);
        }

        return value;
    });
}


// Validator for "undefined-guards"
//
function vUndefinedGuards(key, value)
{
    let validMembers = new Set([ "init", "get", "set" ]);

    return vArrayOrSet(key, value, member => {
        if (!validMembers.has(member)) {
            throw new Error(`Invalid member value for '${key}': '${member}'`);
        }
        
        return member;
    });
}


// Validator for "squeeze-builtins"
//
function vSqueezeBuiltins(key, value)
{
    if (isEmpty(value)) {
        return new Set();

    } else if (isStringArray(value)) {
        return new Set(value);

    } else if (isStringSet(value)) {
        return value;
    }

    throw new Error(`Compiler option '${key}' must be an array or Set of strings.`);
}


// Validator for "vTypescriptLib"
//
function vTypescriptLib(key, value)
{
    if (isEmpty(value)) return [ ];
    if (isString(value)) return value.split(",");
    if (isStringArray(value)) return value;

    throw new Error(`Compiler option '${key}' must be a string or array of strings.`);
}


export class CompilerOptions {


constructor(inOptions)
{
    let allowPrivateOptions = !!inOptions["allow-private-options"];

    for (let key of Object.keys(inOptions)) {
        let option = sOptions.get(key);
        
        if (!option) {
            throw new Error(`Unknown compiler option '${key}'.`);
        }
        
        if (option.p && !allowPrivateOptions) {
            throw new Error(`Compiler option '${key}' is private.`);
        }
    }

    for (let [ key, { v: validator } ] of sOptions.entries()) {
        if (validator) {
            this[key] = validator(key, inOptions[key]);
        } else {
            this[key] = inOptions[key];        
        }
    }
}


allowsIncrementalCompile(previousOptions)
{
    if (!previousOptions) return false;

    for (let [ key, option ] of sOptions.entries()) {
        if (option.i) continue;
        
        if (!Utils.isEqual(this[key], previousOptions[key])) {
            return false;
        }
    }
    
    return true;
}


assertParentCompatibility(parentOptions)
{
    if (!parentOptions) return;

    for (let [ key, option ] of sOptions.entries()) {
        if (option.x) {
            if (this[key] != parentOptions[key]) {
                throw new Error(`Compiler option '${key}' differs from parent's options.`);
            }
        }
    }
}


}

