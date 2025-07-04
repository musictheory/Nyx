//@opts = { }

import assert from "assert";

import fs     from "node:fs";
import path   from "node:path";
import test   from "node:test";
import vm     from "node:vm";

import Nyx from "../lib/api.js";
import { Utils } from "../src/Utils.js";


const IsFastTestEnabled = (process.env["NYX_FAST_TEST"] == "1");


let TypecheckerDefs = null;

function GetTypecheckerDefs()
{
    function makeFile(path) {
        return {
            path: path,
            contents: fs.readFileSync(path).toString()
        };
    }

    if (!TypecheckerDefs) {
        TypecheckerDefs = [ 
            makeFile(Utils.getProjectPath("test/support/assert.d.ts"))
        ];
    }
    
    return TypecheckerDefs;
}


class TestSuite {

    constructor()
    {
        this.name = null;
        this.testCases = [ ];
    }
    
    run()
    {
        const runTestCases = () => {
            for (let testCase of this.testCases) {
                testCase.run();
            }
        };
        
        if (this.name) {
            test.suite(this.name, runTestCases);
        } else {
            runTestCases();
        }
    }

}


class TestCase
{
    constructor(originalFileName)
    {
        this.name    = null;
        this.options = null;
        this.files   = [ ];

        // Error with test case configuration
        this.configError = null;

        this.expectedErrors       = new Set();
        this.expectedWarnings     = new Set();
        this.expectedTypeWarnings = new Set();
        
        this.originalFileName = originalFileName;

        this.expectsNoLineError = false;
        this.runSqueezer        = false;
        this.runTypechecker     = false;
    }
      
    getOriginalNameLine(inNameLine)
    {
        let originalLineNumber = 0;
        
        let m = inNameLine.match(/(.+?):([0-9]+)/);
        let name = m[1];
        let line = parseInt(m[2], 10);

        for (let file of this.files) {
            if (file.name == name) {
                originalLineNumber = file.getOriginalLineNumber(line);
                break;
            }
        }

        if (originalLineNumber) {
            return `${this.originalFileName}:${originalLineNumber}`;    
        } else {
            return inNameLine;
        }
    }
    
    _buildIssueMaps()
    {
        for (let testFile of this.files) {
            let name = testFile.name;
            let lineNumber = 1;

            for (let line of testFile.lines) {
                let m;

                if (m = line.match(/\@error/)) {
                    this.expectedErrors.add(`${name}:${lineNumber}`);

                } else if (m = line.match(/\@warning/)) {
                    this.expectedWarnings.add(`${name}:${lineNumber}`);

                } else if (m = line.match(/\@type\b/)) {
                    this.expectedTypeWarnings.add(`${name}:${lineNumber}`);
                }

                lineNumber++;
            }
        }
    }
    
    _checkMap(expectedSet, actualMap, noun)
    {
        for (let nameLine of expectedSet) {
            let actual = actualMap.get(nameLine);

            if (!actual) {
                let originalNameLine = this.getOriginalNameLine(nameLine);
                throw new Error(`Expected ${noun} at ${originalNameLine}`);
            }
        }
        
        for (let [ nameLine, issue ] of actualMap) {
            if (!expectedSet.has(nameLine)) {
                let originalNameLine = this.getOriginalNameLine(nameLine);

                let e = new Error(`Unexpected ${noun} at ${originalNameLine}`);
                e.cause = issue;
                throw e;
            }
        }
    }

    _checkResult(result)
    {
        let canRun = true;

        let actualNoLineErrors   = [ ];
        let actualErrorMap       = new Map();
        let actualWarningMap     = new Map();
        let actualTypeWarningMap = new Map();

        for (let error of result.errors) {
            canRun = false;

            if (error.line) {
                actualErrorMap.set(`${error.file}:${error.line}`, error);
            } else {
                actualNoLineErrors.push(error);
            }
        }

        for (let warning of result.warnings) {
            canRun = false;

            let map = warning.typechecker ? actualTypeWarningMap : actualWarningMap;
            map.set(`${warning.file}:${warning.line}`, warning);
        }

        if (this.expectsNoLineError && !actualNoLineErrors.length) {
            assert.fail("Expected an error without a line number.");
        } else {
            assert.deepEqual([ ], actualNoLineErrors);
        }
        
        this._checkMap(this.expectedErrors,   actualErrorMap,   "error");
        this._checkMap(this.expectedWarnings, actualWarningMap, "warning");

        if (!IsFastTestEnabled) {
            this._checkMap(this.expectedTypeWarnings, actualTypeWarningMap, "typechecker warning");
        }

        if (canRun) {
            globalThis[Symbol.for("__N$$__")].r();
            
            let script = new vm.Script(result.code, { filename: this.originalFileName } );
            let r = script.runInNewContext({ assert });
            
            if (r === false) {
                assert(r, "Test returned " + r);
            }
        }
    }

    run()
    {
        let options = Object.assign({
            "include-map": true,
            "source-map-file": "file.json",
            "source-map-root": ""    
        }, this.options);
        
        options.files = this.files.map(file => {
            return {
                path: file.name,
                contents: file.lines.join("\n")
            };
        });
        
        if (IsFastTestEnabled) {
            options["dev-fast-test"] = true;
        }
        
        if (this.runTypechecker) {
            options["check-types"] = true;
            options["strict"] = true;
        }

        // Add assert.d.ts to typescript-defs
        if (options["check-types"]) {
            options["defs"] = GetTypecheckerDefs();
        }

        let name = this.name;
        
        this._buildIssueMaps();

        test(name, async () => {
            if (this.configError) {
                throw this.configError;            
            }

            let result;

            try {
                result = await Nyx.compile(options);
                this._checkResult(result);
            } catch (e) {
                if (result?.code) {
                    console.error(name + " Failed, generated code:");
                    console.log(result.code);
                }
       
                throw e;
            }
        });
    }
}


class TestFile
{
    constructor()
    {
        this.name = null;
        this.lines = [ ];
        this.originalLineNumberMap = new Map();
    }
    
    getOriginalLineNumber(lineNumber)
    {
        return this.originalLineNumberMap.get(lineNumber);
    }
    
    addLine(line, originalLineNumber)
    {
        this.lines.push(line);
        this.originalLineNumberMap.set(this.lines.length, originalLineNumber);
    }
}


function processFile(file)
{
    let originalFileName = path.basename(file);
    let inLines = fs.readFileSync(file).toString().split("\n");
    
    let currentSuite = new TestSuite();
    let currentTestCase;
    let currentFile;
    
    const makeTestFile = () => {
        currentFile = new TestFile();
        currentTestCase.files.push(currentFile);
    };

    const makeTestCase = () => {
        currentTestCase = new TestCase(originalFileName);
        currentSuite.testCases.push(currentTestCase);
        makeTestFile();
    };
    
    makeTestCase();

    let originalLineNumber = 1;

    for (let inLine of inLines) {
        let m;

        if (m = inLine.match(/\@suite:(.*?)$/)) {
            if (!currentSuite.name) {
                currentSuite.name = m[1].trim();
            }

        } else if (m = inLine.match(/\@test:(.*?)$/)) {
            // If we already have a named test case, @test creates a new one.
            if (currentTestCase.name) {
                makeTestCase();
            }

            currentTestCase.name = m[1].trim();

        } else if (m = inLine.match(/\@file:(.*?)$/)) {
            // If we already have a named file, @file creates a new one.
            if (currentFile.name) {
                makeTestFile();
            }
            
            currentFile.name = m[1].trim();

        } else if (m = inLine.match(/\@options:(.*?)$/)) {
            try {
                currentTestCase.options = JSON.parse(m[1]);
            } catch (e) {
                currentTestCase.configError = new Error("Invalid test case @options");
                currentTestCase.configError.cause = e;
            }

        } else {
            if (m = inLine.match(/\@error-no-line/)) {
                currentTestCase.expectsNoLineError = true;
            }

            if (m = inLine.match(/\@squeeze/)) {
                currentTestCase.runSqueezer = true;
            }

            if (m = inLine.match(/\@typecheck/)) {
                currentTestCase.runTypechecker = true;
            }

            currentFile.addLine(inLine, originalLineNumber);
        }

        originalLineNumber++;
    } 
    
    // If @test was never specified...
    if (!currentTestCase.name) {
        currentTestCase.name = path.basename(file);
    }

    // If @file was never specified...
    for (let testCase of currentSuite.testCases) {
        for (let file of testCase.files) {
            if (!file.name) {
                file.name = "test.nx";
            }
        }
    }

    return currentSuite;
}


function gatherTestCases(dir)
{
    let testSuites = [ ];

    let nameLinesArray = [ ];

    for (let file of fs.globSync("**/*.nx", { cwd: dir })) {
        if (!file.match(/\.nx$/)) continue;
        testSuites.push(processFile(path.join(dir, file)));
    }
    
    return testSuites;
}


// Add Nyx runtime to global scope
eval(fs.readFileSync(Nyx.getRuntimePath()).toString());

for (let testSuite of gatherTestCases(Utils.getProjectPath("test"))) {
    testSuite.run();
}

