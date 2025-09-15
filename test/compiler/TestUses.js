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


function assertNoIssues(result)
{
    assert.deepStrictEqual(result.warnings, [ ]);
    assert.deepStrictEqual(result.errors,   [ ]);
}


async function runBasicTest(options)
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

    assertNoIssues(result1);
    assertNoIssues(result2);

    eval(result1.code);
    eval(result2.code);
}



test.suite("Compiler API: uses()", () => {
    test("Basic usage", async t => {
        await runBasicTest({
            "check-types": true,
            "defs": support.getTypecheckerDefs(),
        });
    });

    test("Basic usage + squeeze", async t => {
        await runBasicTest({
            "check-types": true,
            "defs": support.getTypecheckerDefs(),

            "squeeze": true,
            "squeeze-builtins": support.getSqueezeBuiltins()
        });
    });

    test("Parent compilers have same class", async t => {
        let compiler1 = new nyx.Compiler();
        let compiler2 = new nyx.Compiler();
        let compiler3 = new nyx.Compiler();
        
        compiler3.uses(compiler1);
        compiler3.uses(compiler2);

        let optionsA = { "files": [ { path: "A.nx", contents: ContentsA } ] };
        let optionsB = { "files": [ { path: "B.nx", contents: ContentsB } ] };

        let result1 = await compiler1.compile(optionsA);
        let result2 = await compiler2.compile(optionsA);
        
        // compiler3.compile() should fail since 'AClass' is defined
        // in both compiler1 and compiler2
        assert.rejects(async () => {
            let result3 = await compiler3.compile(optionsB);
        });
    });

    test("Complex uses()", async t => {
        /*
            Tests the following pattern:
        
                1 - Declares enum Foo and class Bar
              /   \
             2     3  - Uses both Foo and Bar
              \   /
                4  - Uses both Foo and Bar
        */

        let compiler1 = new nyx.Compiler();
        let compiler2 = new nyx.Compiler();
        let compiler3 = new nyx.Compiler();
        let compiler4 = new nyx.Compiler();

        compiler2.uses(compiler1);
        compiler3.uses(compiler1);
        compiler4.uses(compiler2);
        compiler4.uses(compiler3);

        let options1 = { "files": [ { path: "1.nx", contents: "enum Foo { foo, bar, baz }; export class Bar { }" } ] };
        let options2 = { "files": [ { path: "2.nx", contents: "import { Bar }; let x = Foo.foo;" } ] };
        let options3 = { "files": [ { path: "3.nx", contents: "import { Bar }; let y = Foo.bar;" } ] };
        let options4 = { "files": [ { path: "4.nx", contents: "import { Bar }; let z = Foo.baz;" } ] };

        assertNoIssues(await compiler1.compile(options1));
        assertNoIssues(await compiler2.compile(options2));
        assertNoIssues(await compiler3.compile(options3));
        assertNoIssues(await compiler4.compile(options4));
    });


    test("Squeezer conflict", async t => {
        let compiler1 = new nyx.Compiler();
        let compiler2 = new nyx.Compiler();
        let compiler3 = new nyx.Compiler();

        compiler3.uses(compiler1);
        compiler3.uses(compiler2);

        let options1 = {
            "files": [ { path: "1.nx", contents: "export class Foo { static foo() { } }" } ],
            "squeeze": true, "squeeze-start-index": 10, "squeeze-end-index": 20
        };

        let options2 = {
            "files": [ { path: "2.nx", contents: "export class Bar { static foo() { } }" } ],
            "squeeze": true, "squeeze-start-index": 20, "squeeze-end-index": 30
        }

        let options3 = {
            "files": [ { path: "3.nx", contents: "import { Foo, Bar }; let x = Foo.foo, y = Bar.foo" } ],
            "squeeze": true
        }

        assertNoIssues(await compiler1.compile(options1));
        assertNoIssues(await compiler2.compile(options2));
        
        // compiler3.compile() should fail since 'foo' has two different squeezer indices
        assert.rejects(async () => {
            let result3 = await compiler3.compile(options3);
        });
    });
    

});
