// Test "after-compile" option in Compiler API

import test   from "node:test";
import assert from "node:assert";
import nyx    from "../../lib/api.js";


let input = `
let status;

// ...forgot to assign a value to status...

if (status == "ready") {
    console.log('Ready!');
}
`

let options = {
    "files": [ {
        path: "1.nx",
        contents: input
    } ],
    [ "after-compile" ]: async (file) => {
        file.addWarning(6, "'status' is always 'undefined' because it's never assigned.");
    }
};

test.suite("Compiler API: after-compile", () => {
    test("after-compile", async t => {
        let result = await nyx.compile(options);
        
        assert.equal(result.warnings.length, 1);
        assert.equal(result.warnings[0].line, 6);
        assert(result.warnings[0].toString().includes("never assigned"));
    });

});
