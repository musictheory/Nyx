// Test "String Interceptors" language feature

import test   from "node:test";
import assert from "node:assert";
import Nyx    from "../../lib/api.js";


// Our example from README.md
let sCounter = 1;
let sLogMessageMap = new Map();

function interceptLogMessage(strings) {
    return strings.map(s => {
        if (s.match(/[A-Za-z]/)) {
            let transformed = `#Log${sCounter++}#`;
            sLogMessageMap.set(transformed, s);
            return transformed;
        } else {
            return s;
        }
    });
}

// Only returns a single string regardless of strings.length, Oops.
function badInterceptor(strings) {
    return [ "badInterceptor" ];
}


test.suite("Feature: String Interceptors", () => {
    test("Basic usage", async t => {
        let input = `
            function L() {
                throw new Error("L() should not be called - should be intercepted");            
            }

            let a = "A";
            let b = "B";
            let c = "C";

            assert.equal(
                L\`This\${a}is\${b}a\${c}test\`,
                "#Log1#A#Log2#B#Log3#C#Log4#"
            );

            assert.equal(
                L\`This is another test\`,
                "#Log5#"
            );
                
            assert.equal(
                X\`Yet another test.\`,
                "badInterceptor"
            );
        `;

        let options = {
            "files": [ { path: "1.nx", contents: input } ],
            [ "interceptors" ]: { "L": interceptLogMessage, "X": badInterceptor }
        };

        let result = await Nyx.compile(options);

        assert.deepEqual(result.warnings, [ ]);
        assert.deepEqual(result.errors,   [ ]);

        eval(result.code);
    });

    test("Error on string count mismatch", async t => {
        let input = `
            let a = "A";
            let x = X\`1\${a}2\`;
        `;

        let options = {
            "files": [ { path: "1.nx", contents: input } ],
            [ "interceptors" ]: { "X": badInterceptor }
        };

        let result = await Nyx.compile(options);
        
        assert.equal(result.errors.length, 1);
        assert(result.errors.toString().includes("mismatch"));
    });
});

