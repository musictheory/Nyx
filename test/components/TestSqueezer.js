import { Squeezer } from "../../src/Squeezer.js";
import assert from "node:assert";
import test from "node:test";

/*
    Low-level tests for Squeezer.
*/

test("Squeezer", t => {
    let squeezer = new Squeezer(null, 0, 0, new Set());
    
    // "init" should never be squeezed
    assert.equal(squeezer.squeeze("init"), "init");
    
    // Test squeezing roundtrip
    let squeezedFoo = squeezer.squeeze("foo");
    assert.notEqual(squeezedFoo, "foo");
    assert.equal(squeezer.unsqueeze(squeezedFoo), "foo");

    let squeezedBar = squeezer.squeeze("bar");
    assert.notEqual(squeezedBar, "bar");
    assert.equal(squeezer.unsqueeze(squeezedBar), "bar");

    let squeezedBaz = squeezer.squeeze("baz");
    assert.notEqual(squeezedBaz, "baz");
    assert.equal(squeezer.unsqueeze(squeezedBaz), "baz");

    // Test getSqueezeMap()
    assert.deepStrictEqual(squeezer.getSqueezeMap(), Object.assign(Object.create(null), {
        [ squeezedFoo ]: "foo",
        [ squeezedBar ]: "bar",
        [ squeezedBaz ]: "baz"
    }));
});


