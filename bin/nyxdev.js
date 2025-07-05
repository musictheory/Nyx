#!/usr/bin/env node 

/*
    (c) 2025 musictheory.net, LLC
    MIT license, http://www.opensource.org/licenses/mit-license.php

    This is a command-line tool used for development.
    
    It is not intended to compile actual projects.
    To compile Nyx code, see "Compiling Projects" in README.md
*/

import fs     from "node:fs";
import util   from "node:util";
import vm     from "node:vm";
import nyx    from "../lib/api.js";
import { Parser } from "../src/ast/Parser.js";

import { parse as acornParse } from "acorn";


const Usage = `Usage: nyxdev.js [OPTIONS] INPUT_FILES

    -t, --ts, --typescript     Output TypeScript for typechecker
        --ast, --dump-ast      Output Nyx AST
        --dump-function-map    Output function map (internal use only)
        --raw-errors           Show raw errors
    -h, --help                 Display this help

    Respository:  https://github.com/musictheory/Nyx
`;


const ParseArgsOptions = {
    "help":      { type: "boolean", short: "h" },

    // --typescript, --ts, -t
    // Outputs the TypeScript code used for type checking
    "typescript": { type: "boolean", short: "t" },
    "ts":         { type: "boolean" },

    // --dump-ast, --ast
    // Dumps AST from Parser
    "dump-ast":   { type: "boolean" },
    "ast":        { type: "boolean" },

    // --dump-function-map
    // Dumps internal function map
    "dump-function-map": { type: "boolean" },
    
    
    // --raw-errors
    "raw-errors": { type: "boolean" },
}


function printIssues(issues)
{
    function toString(e) {
        let result  = "";

        let file   = e.file   || e.filename;
        let line   = e.line   || e.lineNumber;
        let column = e.column || e.columnNumber || e.col;
        let reason = e.reason || e.description || e.message;

        if (file)   result += file;
        if (line)   result += ":" + line;
        if (column) result += ":" + column;
        if (reason) result += " " + reason;

        return result;
    }

    let strings = (issues ?? [ ]).map(issue => toString(issue));
    strings = [ ... new Set(strings) ].sort();
    console.error(strings.join("\n"));
}


function slurpOptions(files)
{
    let options;

    // Find the first { } block inside of a JavaScript comment
    // and treat it as our options.
    for (let file of files) {
        let contents = file.contents;
        let comments = [ ];

        try {
            acornParse(contents, {
                ecmaVersion: 2022,
                onComment: function(block, text, start, end) {
                    comments.push(text);
                }
            });
        } catch (e) { }

        try {
            let m;
            if (m = comments.join("").match(/({.*})/)) {
                let output = { };
                (new vm.Script("output.options = " + m[1])).runInNewContext({ output });
                options = output.options;
            }
        } catch (e) { }

        if (options) break;
    }
    
    return options ?? { };
}


function main()
{
    let parsedArgs;

    try {
        parsedArgs = util.parseArgs({
            options: ParseArgsOptions,
            allowPositionals: true
        });

    } catch (e) {
        console.error(e.toString());
        process.exit(1);
    }

    if (parsedArgs.values["help"]) {
        process.stdout.write(Usage);
        process.exit(0);
    }

    let files = parsedArgs.positionals.map(positional => {
        try {
            let contents = (fs.readFileSync(positional).toString());
            return { path: positional, contents: contents };
        } catch (e) {
            console.error("nyxdev: error reading file: " + e);
            process.exit(1);
        }
    });

    if (!files.length) {
        console.error("nyxdev: No input files specified");
        process.exit(1);
    }

    if (parsedArgs.values["dump-ast"] || parsedArgs.values["ast"]) {
    
        for (let f of files) {
            let path = f.path;
            let contents = f.contents;
            
            try {
                let ast = Parser.parse(contents);
                let string = JSON.stringify(ast, null, "    ");
                console.log(`${path}: ${string}`);
            } catch (e) {
                console.error(`Error parsing '${path}': ${e}`);
            }        
        }

        return;
    }

    let options = slurpOptions(files);
    options.files = files;
    
    options["dev-omit-runtime"] = true;
    
    if (parsedArgs.values["typescript"] || parsedArgs.values["ts"]) {
        options["output-language"] = "typechecker";
    
    } else if (parsedArgs.values["dump-function-map"]) {
        options["allow-private-options"] = true;
        options["include-function-map"] = true;
    }

    nyx.compile(options).then(result => {
        if (parsedArgs.values["raw-errors"] && result.errors.length > 0) {
            console.error(result.errors);
        } else {
            printIssues(result.errors);
        }
        
        printIssues(result.warnings);    

        if (result.functionMap) {
            for (let key of Object.keys(result.functionMap)) {
                console.log(key);
                for (let line of result.functionMap[key]) {
                    console.log(`${line[0]}: ${line[1]}`);
                }
                console.log();
            }

        } else if (result.code) {
            process.stdout.write(result.code);
        }
    });
}


main();

