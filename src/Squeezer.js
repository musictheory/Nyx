/*
    Squeezer.js
    (c) 2013-2025 musictheory.net, LLC
    MIT license, http://www.opensource.org/licenses/mit-license.php
*/

import { CompilerIssue } from "./model/CompilerIssue.js";


const sBase62Digits = "etnrisouaflchpdvmgybwESxTNCkLAOMDPHBjFIqRUzWXVJKQGYZ0516372984";

function sToBase62(index)
{
    let result = "";

    do {
        result += sBase62Digits.charAt(index % 62);
        index = Math.floor(index / 62);
    } while (index > 0);

    return result;
}


const sCountMap = new Map();

export class Squeezer {

constructor(parents, start, max, inBuiltins)
{
    this._id       = start;
    this._maxId    = max;
    this._toMap    = new Map();            // key: symbol, value: squeezed symbol
    this._fromMap  = new Map();            // key: squeezed symbol, value: symbol

    let builtins = new Set();

    // Never squeeze "init", as it is called by runtime.js
    builtins.add("init");
    builtins = builtins.union(inBuiltins);

    if (parents) {
        for (let parent of parents) {
            for (let [ key, value ] of parent._toMap) {
                this._addPair(key, value);
            }

            builtins = builtins.union(parent._builtins);
        }
    }

    this._builtins = builtins;
}


_addPair(readableName, squeezedName)
{
    let fromMap = this._fromMap;
    let toMap   = this._toMap;

    let existing = this._toMap.get(readableName);
    if (existing && (existing != squeezedName)) {
        throw new CompilerIssue(`Squeezer conflict for '${readableName}': '${existing}' vs '${squeezedName}'`);
    }

    // if (fromMap.has(squeezedName)) {
    //     throw new CompilerIssue(`Squeezer conflict for '${readableName}': '${squeezedName}'`);
    // }    

    toMap.set(readableName, squeezedName);
    fromMap.set(squeezedName, readableName);

    return squeezedName;
}


_addName(readableName)
{
    if (this._builtins.has(readableName)) {
        return readableName;
    }

    let squeezedName = "N$" + sToBase62(this._id);
    this._id++;

    if (this._maxId && (this._id >= this._maxId)) {
        throw new CompilerIssue(`Squeezer reached max index of ${this._maxId}`);
    } 
   
    return this._addPair(readableName, squeezedName);
}


getSqueezeMap()
{
    let result = Object.create(null);
    
    for (let [ key, value ] of this._fromMap.entries()) {
        result[key] = value;    
    }
    
    return result;
}


squeeze(name)
{
    return this._toMap.get(name) ?? this._addName(name);
}


unsqueeze(name)
{
    return this._fromMap.get(name) ?? name;
}


}


