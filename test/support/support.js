import fs     from "node:fs";
import path   from "node:path";

import { Utils } from "../../src/Utils.js";

let sSqueezeBuiltins = null;
let sTypecheckerDefs = null;


export function getSqueezeBuiltins()
{
    if (!sSqueezeBuiltins) {
        let contents = fs.readFileSync(Utils.getProjectPath("test/support/builtins.json"));
        sSqueezeBuiltins = JSON.parse(contents.toString());
    }

    return sSqueezeBuiltins;
}


export function getTypecheckerDefs()
{
    function makeFile(path) {
        return {
            path: path,
            contents: fs.readFileSync(path).toString()
        };
    }

    if (!sTypecheckerDefs) {
        sTypecheckerDefs = [ 
            makeFile(Utils.getProjectPath("test/support/assert.d.ts"))
        ];
    }
    
    return sTypecheckerDefs;
}


export default {
    getTypecheckerDefs,
    getSqueezeBuiltins
};

