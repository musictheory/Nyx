// Test symbolicate() API

import assert from "node:assert";
import test   from "node:test";
import vm     from "node:vm";

import nyx    from "../../lib/api.js";
   
            
test.suite("Compiler API: symbolicate()", () => {
    test("Basic Usage", async t => {
        for (let [ input, expected ] of [
            [ "N$f_$_foo_bar",  "_foo(bar:)"   ],
            [ "N$f_$_foo__bar", "_foo(_:bar:)" ],
            [ "N$i_TheImport",  "TheImport"    ],
            [
                "Hello N$f_$_foo__bar and N$f_$_foo__baz",
                "Hello _foo(_:bar:) and _foo(_:baz:)"
            ]
        ]) {
            assert.equal(nyx.symbolicate(input), expected);
        }
    });

    test("Squeeze Roundtrip", async t => {
        const contents = `
            let x = { foo: 1, bar: 2, baz: 3 };
            output.o1 = Object.keys(x).join(" ");
            
            class Foo { func foo(bar a0: string, baz a1: string) { } }
            output.o2 = Object.getOwnPropertyNames(Foo.prototype).join(" ");
        `;
    
        let results = await nyx.compile({
            files: [ { path: "A.nx", contents: contents } ],
            squeeze: true,
            "squeeze-builtins": [
                "output", "o1", "o2",
                "Object", "keys",  "join",
                "getOwnPropertyNames", "prototype"
            ]
        });
        
        let output = { };
        (new vm.Script(results.code)).runInNewContext({ output });
    
        let { o1, o2 } = output;
        
        // code should be squeezed and should not contain foo/bar/baz
        assert.equal(typeof results.code, "string");
        assert.equal(results.code.indexOf("foo"), -1);
        assert.equal(results.code.indexOf("bar"), -1);
        assert.equal(results.code.indexOf("baz"), -1);
    
        // The first output string should be squeezed and should not contain foo/bar/baz
        assert.equal(typeof o1, "string");
        assert.equal(o1.indexOf("foo"), -1);
        assert.equal(o1.indexOf("bar"), -1);
        assert.equal(o1.indexOf("baz"), -1);
        
        // Now symbolicate the first output string and make sure it contains foo/bar/baz
        let symbolicated1 = nyx.symbolicate(o1, results.squeezed);
        assert.equal(symbolicated1.includes("foo"), true);
        assert.equal(symbolicated1.includes("bar"), true);
        assert.equal(symbolicated1.includes("baz"), true); 

        // The second output string should be squeezed and should not contain foo/bar/baz
        assert.equal(typeof o2, "string");
        assert.equal(o2.indexOf("foo"), -1);
        assert.equal(o2.indexOf("bar"), -1);
        assert.equal(o2.indexOf("baz"), -1);

        // Now symbolicate the first output string and make sure it contains the
        // human-readable function name of 'foo(bar:baz:)'
        let symbolicated2 = nyx.symbolicate(o2, results.squeezed);
        assert.equal(symbolicated2.includes("foo(bar:baz:)"), true);
    });
});
