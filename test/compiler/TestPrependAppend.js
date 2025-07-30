// Test "prepend" and "append" options in Compiler API

import test   from "node:test";
import assert from "node:assert";
import nyx    from "../../lib/api.js";


test.suite("Compiler API: prepend/append", () => {
    test("strings", async t => {
        let options = {
            "prepend": "// Prepended content",
            "append":  "// Appended content",
            "files": [ { path: "1.nx", contents: "function moo() { }" } ]
        };

        let result = await nyx.compile(options);
        let code = result.code;
        
        assert(code.indexOf("Prepended") < code.indexOf("function"));
        assert(code.indexOf("Appended")  > code.indexOf("function"));
    });

    test("arrays", async t => {
        let options = {
            "prepend": [ "// Prepended content 1", "// Prepended content 2" ],
            "append":  [ "// Appended content 3",  "// Appended content 4" ],
            "files": [ { path: "1.nx", contents: "function moo() { }" } ]
        };

        let result = await nyx.compile(options);
        let code = result.code;
        
        assert(code.indexOf("content 1") < code.indexOf("function"));
        assert(code.indexOf("content 2") < code.indexOf("function"));
        assert(code.indexOf("content 3") > code.indexOf("function"));
        assert(code.indexOf("content 4") > code.indexOf("function"));
    });

    test("allow null", async t => {
        let options1 = {
            "files": [ { path: "1.nx", contents: "function moo() { }" } ]
        };

        let options2 = Object.assign({
            "prepend": null,
            "append":  null
        }, options1);

        let result1 = await nyx.compile(options1);
        let result2 = await nyx.compile(options2);

        assert.equal(result1.code, result2.code);
    });
});
