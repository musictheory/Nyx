// Test "before-compile" option in Compiler API

import test   from "node:test";
import assert from "node:assert";
import nyx    from "../../lib/api.js";


test.suite("Compiler API: before-compile", () => {
    test("Basic replacement", async t => {
        let input = `
            function moo() { return "foo"; }
            assert.equal(moo(), "moo");
        `;

        let options = {
            "files": [ { path: "1.nx", contents: input } ],
            [ "before-compile" ]: async (file) => {
                let contents = file.getContents();
                let path     = file.getPath();

                assert.equal(path, "1.nx");

                contents = contents.replaceAll("foo", "moo");

                file.setContents(contents);
            }
        };

        let result = await nyx.compile(options);
        eval(result.code);
    });

    test("Throws on line count mismatch", async t => {
        let input = `function moo() { return "foo"; }`;
        
        let options = {
            "files": [ { path: "1.nx", contents: input } ],
            [ "before-compile" ]: async (file) => {
                file.setContents("\n\n\n");
            }
        };

        let result = await nyx.compile(options);
        
        assert.equal(result.errors.length, 1);
        assert(result.errors.toString().includes("mismatch"));
    });

    test("Expands trimmed lines", async t => {
        let input = "\n\n\n\n\n\n";
        
        let options = {
            "files": [ { path: "1.nx", contents: input } ],
            [ "before-compile" ]: async (file) => {
                let oldLineCount = file.getContents().split("\n").length;

                file.setContents("");
                let newLineCount = file.getContents().split("\n").length;

                assert.equal(oldLineCount, newLineCount);
            }
        };

        let result = await nyx.compile(options);
    });
});

