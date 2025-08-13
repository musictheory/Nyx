import { Utils } from "../../src/Utils.js";
import assert from "node:assert";
import test from "node:test";
import os from "node:os";


test("Utils.log", t => {
    Utils.enableLog();

    let didLog = false;
    console.log = function() { didLog = true };
    Utils.log("Hello");

    assert(didLog, true);
});


test("Utils.isEqual", t => {

    function testIsEqual(a, b, value)
    {
        assert.equal(Utils.isEqual(a, b), value);
        assert.equal(Utils.isEqual(b, a), value);
    }

    function objectToMap(obj, reverse)
    {
        let keys = Array.from(Object.keys(obj));
        if (reverse) keys.reverse();
        
        let m = new Map();
        for (let key of keys) {
            m.set(key, obj[key]);
        }
        
        return m;
    }

    let setABC  = new Set([ "A", "B", "C" ]);
    let setABCD = new Set([ "A", "B", "C", "D" ]);
    let setCBA  = new Set([ "C", "B", "A" ]);
    
    let arrayABC  = [ "A", "B", "C" ];
    let arrayABCD = [ "A", "B", "C", "D" ];
    let arrayCBA  = [ "C", "B", "A" ];
    
    let objectABC  = {
        "A": "Alpha", "B": "Bravo", "C": "Charlie"
    };

    let objectABCD = {
        "A": "Alpha", "B": "Bravo", "C": "Charlie", "D": "Delta"
    };
    
    let mapABC  = objectToMap(objectABC);
    let mapABCD = objectToMap(objectABCD);
    let mapCBA  = objectToMap(objectABC, true);
    
    testIsEqual(true, true, true);
    testIsEqual(true, "Moo", false);
    testIsEqual(0, 0, true);
    testIsEqual(0, null, false);

    testIsEqual(setABC, setCBA, true);
    testIsEqual(setABC, setABC, true);
    testIsEqual(setABC, setABCD, false);
    testIsEqual(setABC, arrayABC, false);
    testIsEqual(setABC, null, false);
    testIsEqual(setABC, "Moo", false);

    testIsEqual(arrayABC, arrayABC, true);
    testIsEqual(arrayABC, arrayABC.slice(0), true);
    testIsEqual(arrayABC, arrayABCD, false);
    testIsEqual(arrayABC, arrayCBA,  false);

    testIsEqual(mapABC, mapABC, true);
    testIsEqual(mapABC, objectABC, false);
    testIsEqual(mapABC, setABC, false);
    testIsEqual(mapABC, mapABCD, false);
    testIsEqual(mapABC, mapCBA, true);

    testIsEqual(objectABC, objectABC, true);
    testIsEqual(objectABC, objectABCD, false);
    testIsEqual(objectABC, { }, false);
    testIsEqual(objectABC, { "A": "", "B": "", "C": "" }, false);

    objectABC["D"] = "Delta";
    testIsEqual(objectABC, objectABCD, true);

});

