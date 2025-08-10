// Test Compiler.prototype.uses() API

import test   from "node:test";
import assert from "node:assert";
import nyx    from "../../lib/api.js";

if (!process.env["NYX_FAST_TEST"]) {
    test.suite("Compiler API: generateBuiltins()", () => {
        test("Basic usage", async t => {
            let builtins = await nyx.generateBuiltins({
                "typescript-target": "es2020",
                "typescript-lib": "es2020",
                "unused-interfaces": [ /Atomics/ ],
                "unused-namespaces": [ /Intl/ ]
            });
            
            const shouldInclude = [
                "join", "split",
                "toLocaleTimeString",
            ];

            const shouldNotInclude = [
                "foo", "bar", "baz",
                "compareExchange", // From Atomics
                "getCanonicalLocales" // From Intl
            ];            
            
            for (let name of shouldInclude) {
                assert.equal(builtins.includes(name), true);
            }
            
            for (let name of shouldNotInclude) {
                assert.equal(builtins.includes(name), false);
            }
        });
    });
}