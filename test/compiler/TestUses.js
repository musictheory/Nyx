// Test Compiler.prototype.uses() API

import test   from "node:test";
import assert from "node:assert";
import nyx    from "../../lib/api.js";

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


test.suite("Compiler API: uses()", () => {
    test("Basic usage", async t => {
        let options1 = {
            "files": [
                { path: "A.nx", contents: ContentsA },
                { path: "B.nx", contents: ContentsB }
            ]
        };

        let options2 = {
            "files": [
                { path: "C.nx", contents: ContentsC }
            ]       
        };
        
        let compiler1 = new nyx.Compiler();
        let compiler2 = new nyx.Compiler();
        
        assert.throws(() => { compiler2.uses(null); });
        assert.throws(() => { compiler2.uses("moo"); });
        
        compiler2.uses(compiler1);

        let result1 = await compiler1.compile(options1);
        let result2 = await compiler2.compile(options2);

        assert.equal(result1.warnings.length, 0);
        assert.equal(result1.errors.length,   0);

        assert.equal(result2.warnings.length, 0);
        assert.equal(result2.errors.length,   0);
        
        eval(result1.code);
        eval(result2.code);
    });

});
