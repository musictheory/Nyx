/*
    Utils.js
    (c) 2013-2025 musictheory.net, LLC
    MIT license, http://www.opensource.org/licenses/mit-license.php
*/

import path from "node:path";
import fs   from "node:fs";
import { fileURLToPath } from "node:url";


let sShouldLog = false;

function enableLog()
{
    sShouldLog = true;
}


function log()
{
    if (!sShouldLog) return;
    console.log.apply(this, Array.from(arguments));
}


function getProjectPath(file)
{
    let base = fileURLToPath(new URL("..", import.meta.url));
    return path.resolve(base, file);
}


function _isEqualObject(obj1, obj2)
{
    let keys1 = Array.from(Object.keys(obj1)).sort();
    let keys2 = Array.from(Object.keys(obj2)).sort();
    
    if (!_isEqualArray(keys1, keys2)) {
        return false;
    }

    for (let key of keys1) {
        if (!isEqual(obj1[key], obj2[key])) {
            return false;
        }
    }

    return true;
}


function _isEqualArray(arr1, arr2)
{
    let length = arr1.length;

    if (length != arr2.length) {
        return false;
    }

    for (let i = 0; i < length; i++) {
        if (!isEqual(arr1[i], arr2[i])) {
            return false;
        }
    }
    
    return true;
}


function _isEqualMap(map1, map2)
{
    for (let key of map1.keys()) {
        if (!isEqual(map1.get(key), map2.get(key))) {
            return false;
        }
    }
    
    for (let key of map2.keys()) {
        if (!map1.has(key)) {
            return false;
        }
    }
    
    return true;
}


function _isEqualSet(set1, set2)
{
    return set1.symmetricDifference(set2).size === 0;
}


function isEqual(obj1, obj2)
{
    // First, check using Object.is
    if (Object.is(obj1, obj2)) {
        return true;
    }
    
    // If either are primitives, Object.is() should have us covered
    if ((typeof obj1 !== "object") || (typeof obj2 !== "object")) {
        return false;
    }
    
    const isMap1   = obj1 instanceof Map, isMap2 = obj2 instanceof Map,
          isSet1   = obj1 instanceof Set, isSet2 = obj2 instanceof Set,
          isArray1 = Array.isArray(obj1), isArray2 = Array.isArray(obj2);

    if (isMap1 || isMap2) {
        return (isMap1 && isMap2) ? _isEqualMap(obj1, obj2): false;

    } else if (isSet1 || isSet2) {
        return (isSet1 && isSet2) ? _isEqualSet(obj1, obj2) : false;

    } else if (isArray1 || isArray2) {
        return (isArray1 && isArray2) ? _isEqualArray(obj1, obj2): false;
    
    } else {
        return _isEqualObject(obj1, obj2);
    }
}


export const Utils = {
    getProjectPath,
    
    isEqual,

    enableLog,
    log
};
