import { CompilerOptions } from "../../src/model/CompilerOptions.js";
import assert from "node:assert";
import test from "node:test";


test("CompilerOptions", t => {
    let f = () => { };
    
    function testOption(key, inValue, outValue) {
        let options = new CompilerOptions({ [ key ]: inValue });
        assert.deepStrictEqual(options[key], outValue);
    }
    
    function makeMap(obj) {
        let map = new Map();

        for (let [ key, value ] of Object.entries(obj)) {
            map.set(key, value);
        }

        return map;
    }

    assert.throws(() => { testOption("foo", 42, null); });
    assert.throws(() => { testOption("include-bridged", true, null); });

    testOption("files", null, [ ]);
    testOption("files", [ "moo" ], [ { path: "moo", contents: null, time: 0 } ]);
    testOption("files", [ { path: "moo" } ], [ { path: "moo", contents: null, time: 0 } ]);
    testOption("files", [ { path: "moo", contents: "moo", time: 42 } ], [ { path: "moo", contents: "moo", time: 42 } ]);

    assert.throws(() => { testOption("files", { }, null); });
    assert.throws(() => { testOption("files", [ 42 ], null); });
    assert.throws(() => { testOption("files", [ { } ], null); });
    assert.throws(() => { testOption("files", [ { path: "" } ], null); });

    testOption("prepend", null, [ ]);
    testOption("prepend", [ "Foo" ], [ "Foo" ]);
    testOption("prepend", "Foo\nBar\nBaz", [ "Foo", "Bar", "Baz" ]);
    assert.throws(() => { testOption("prepend", 42, null); });

    testOption("include-map", null, false);
    testOption("include-map", true, true);
    assert.throws(() => { testOption("include-map", { }, null); });
    
    testOption("source-map-file", "Moo", "Moo");
    testOption("source-map-file", null, null);
    assert.throws(() => { testOption("source-map-file", 42, null); });
    
    testOption("before-compile", f, f);
    testOption("before-compile", null, null);
    assert.throws(() => { testOption("before-compile", 42, null); });

    testOption("interceptors", null, new Map());
    testOption("interceptors", { "C": f }, makeMap({ "C": f }));
    testOption("interceptors", makeMap({ "C": f }), makeMap({ "C": f }));
    assert.throws(() => { testOption("interceptors", 42, null); });
    assert.throws(() => { testOption("interceptors", makeMap({ "C": 42 }), null); });

    // Test invalid map where key is non-string    
    {
        let invalidMap = new Map();
        invalidMap.set(42, f);
        assert.throws(() => { testOption("interceptors", invalidMap, null); });
    }

    testOption("additional-globals", null, new Map());
    testOption("additional-globals", { }, new Map());
    testOption("additional-globals", { "Moo": 42    }, makeMap({ "Moo": 42 }));
    testOption("additional-globals", { "Moo": null  }, makeMap({ "Moo": null }));
    testOption("additional-globals", makeMap({ "Moo": "Moo", "Foo": "Bar" }), makeMap({ "Moo": "Moo", "Foo": "Bar" }));
    assert.throws(() => { testOption("additional-globals", { "Moo": { } }, null); });

    testOption("observers", null, new Map());
    testOption("observers", { "moo": 42    }, makeMap({ "moo": 42 }));
    testOption("observers", { "moo": "moo" }, makeMap({ "moo": "moo" }));
    assert.throws(() => { testOption("observers", { "moo": null }, null); });

    testOption("target-tags", null, new Map());
    testOption("target-tags", { "moo": true }, makeMap({ "moo": true }));
    testOption("target-tags", makeMap({ "moo": false }), makeMap({ "moo": false }));
    assert.throws(() => { testOption("target-tags", { "moo": null }, null); });

    testOption("squeeze-start-index", null, 0);
    testOption("squeeze-start-index", 42, 42);
    assert.throws(() => { testOption("squeeze-start-index", "moo", null); });

    testOption("squeeze-builtins", null, new Set());
    testOption("squeeze-builtins", [ "A", "B" ], new Set([ "A", "B" ]));
    testOption("squeeze-builtins", new Set([ "A", "B" ]), new Set([ "A", "B" ]));
    assert.throws(() => { testOption("squeeze-builtins", new Set([ 42 ]), null); });
    assert.throws(() => { testOption("squeeze-builtins", [ 42 ], null); });

    testOption("typescript-lib", null, [ ]);
    testOption("typescript-lib", "foo,bar", [ "foo", "bar" ]);
    testOption("typescript-lib", [ "foo" , "bar" ], [ "foo", "bar" ]);
    assert.throws(() => { testOption("typescript-lib", 42, null); });

    testOption("undefined-guards", null, new Set());
    testOption("undefined-guards", [ ], new Set());
    testOption("undefined-guards", [ "init", "get" ], new Set([ "init", "get" ]));
    assert.throws(() => { testOption("undefined-guards", 42, null); });
    assert.throws(() => { testOption("undefined-guards", [ 5 ], null); });
    assert.throws(() => { testOption("undefined-guards", [ "moo" ], null); });

    // allowsIncrementalCompile()
    {
        let o1 = new CompilerOptions({ "files": [ ], "prepend": "Moo" });
        let o2 = new CompilerOptions({ "files": [ ], "prepend": "Foo" });

        let o3 = new CompilerOptions({ "observers": makeMap({ "A": 1 }) });
        let o4 = new CompilerOptions({ "observers": makeMap({ "B": 2 }) });
        
        assert.equal(o1.allowsIncrementalCompile(o2), true);
        assert.equal(o1.allowsIncrementalCompile(o3), false);
        assert.equal(o3.allowsIncrementalCompile(o4), false);
    }

    // assertCompatibilityWithParent()
    {
        let o1 = new CompilerOptions({ "squeeze": true });
        let o2 = new CompilerOptions({ "squeeze": false });

        let o3 = new CompilerOptions({ "prepend": "Moo" });
        let o4 = new CompilerOptions({ "prepend": "Foo" });

        o3.assertParentCompatibility(o2);
        o3.assertParentCompatibility(o4);

        assert.throws(() => { o1.assertParentCompatibility(o2) });
    }
});

