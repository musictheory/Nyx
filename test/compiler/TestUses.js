// Test Compiler.prototype.uses() API

import test   from "node:test";
import assert from "node:assert";

import nyx     from "../../lib/api.js";
import support from "../support/support.js";


const ContentsA = `
    export class AClass {
        func getName(): string { return "A"; }

        func runTest(expectedString: string) {
            assert.equal(this.getName(), expectedString);
        }
    }
`;

const ContentsB = `
    import { AClass };
    export class BClass extends AClass {
        func getName(): string { return super.getName() + "B"; }
    }
`;

const ContentsC = `
    import { BClass };
    export class CClass extends BClass {
        func getName(): string { return super.getName() + "C"; }
    }
        
    let c = new CClass();
    c.runTest(expectedString: "ABC");
`;


async function runTest(options)
{
    let options1 = Object.assign({
        "files": [
            { path: "A.nx", contents: ContentsA },
            { path: "B.nx", contents: ContentsB }
        ]
    }, options || { });

    let options2 = Object.assign({
        "files": [
            { path: "C.nx", contents: ContentsC }
        ]       
    }, options || { });
    
    let compiler1 = new nyx.Compiler();
    let compiler2 = new nyx.Compiler();
    
    assert.throws(() => { compiler2.uses(null); });
    assert.throws(() => { compiler2.uses("moo"); });
    
    compiler2.uses(compiler1);

    let result1 = await compiler1.compile(options1);
    let result2 = await compiler2.compile(options2);

    assert.deepStrictEqual(result1.warnings, [ ]);
    assert.deepStrictEqual(result1.errors,   [ ]);

    assert.deepStrictEqual(result2.warnings, [ ]);
    assert.deepStrictEqual(result2.errors,   [ ]);
    
    eval(result1.code);
    eval(result2.code);
}



test.suite("Compiler API: uses()", () => {
    test("Basic usage", async t => {
        await runTest({
            "check-types": true,
            "defs": support.getTypecheckerDefs(),
        });
    });

    test("Basic usage + squeeze", async t => {
        await runTest({
            "check-types": true,
            "defs": support.getTypecheckerDefs(),

            "squeeze": true,
            "squeeze-builtins": support.getSqueezeBuiltins()
        });
    });

});
