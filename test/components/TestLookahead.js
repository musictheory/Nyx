/*
    Unlike Esprima, Acorn doesn't provide saveState()/restoreState(),
    which we need to perform lookahead.
    
    This test case ensures that all parser state is saved and restored.
    
    If it fails, an update to Acorn added a new property to their Parser class.
*/

import { Parser } from "../../src/ast/Parser.js";
import test from "node:test";


class TestLookaheadParser extends Parser {

#makeSnapshot()
{
    let snapshot = { };
    Object.assign(snapshot, this);

    // Ensure that context is a copy
    snapshot.context = this.context.slice(0);
    
    return snapshot;
}


saveState()
{
    let thisSnapshot = this.#makeSnapshot();

    let state = super.saveState();

    state.__this_snapshot__ = thisSnapshot;

    return state;
}


restoreState(state)
{
    let thisSnapshotA = state.__this_snapshot__;
    delete(state.__this_snapshot__);

    super.restoreState(state);

    let thisSnapshotB = this.#makeSnapshot();
    
    let diffs = [ ];
    
    let keys = new Set([
        ...Object.keys(thisSnapshotA),
        ...Object.keys(thisSnapshotB)
    ]);

    for (let key of keys) {
        let valueA, valueB, ok;

        if (key == "context") {
            valueA = JSON.stringify(thisSnapshotA[key]);
            valueB = JSON.stringify(thisSnapshotB[key]);

            ok = (valueA == valueB);

        } else {
            valueA = thisSnapshotA[key];
            valueB = thisSnapshotB[key];

            ok = (valueA === valueB);
        }

        if (!ok) {
            diffs.push(`'${key}' is different:`);
            diffs.push(`    A: ${valueA}`);
            diffs.push(`    B: ${valueB}`);
        }
    }

    if (diffs.length) {
        throw new Error(diffs.join("\n"));
    }
}

}


let input = `
    let a: Foo<Bar<A, B>>;
    let b: (number) => string;
    let c: (number);
    let d: (...foo) => void;
    let e: (
             number)
`;

test("Parser Lookahead", t => {
    TestLookaheadParser.parse(input, { ecmaVersion: 2022, locations: true });
});
