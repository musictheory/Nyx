import { Parser    } from "../../src/ast/Parser.js";
import { Traverser } from "../../src/ast/Traverser.js";
import assert from "node:assert";
import test from "node:test";

/*
    Traverser has high code coverage via our other tests.
    Check that it throws on an unknown node type.
*/

test("Traverser", t => {
    let ast = Parser.parse("function foo() { }", { ecmaVersion: 2022, locations: true });

    ast.body[0].type = "__AnUnknownASTNodeType__";
    
    assert.throws(() => {
        let traverser = new Traverser(ast);
        traverser.traverse((node, parent) => { }, () => { });
    });
});


