import { Parser } from "../../src/ast/Parser.js";
import { TypePrinter } from "../../src/ast/TypePrinter.js";
import assert from "node:assert";
import test from "node:test";



test("TypePrinter", t => {
    for (let testCase of [
        "this",
        "string",
        "string | number",
        "Foo & Bar | Baz",
        "Foo | Bar & Baz",
        "(Foo)",
        "[ number, number, string ]",
        "[ number, number, ...string[] ]",
        "typeof Foo",
        "typeof Foo.bar",
        "typeof Foo<A, B>",
        "Foo<A, B>",
        "readonly Foo",
        "Foo['bar']",
        "(a: string, b: number) => void",
        "6",
        "-5",
        "{ a: string, b?: number, c: string }",

        [
            "Foo?",
            "(Foo | null)"
        ],

        [
            "Foo[]?",
            "(Foo[] | null)"
        ],        

        [
            "Foo?[]",
            "(Foo | null)[]"
        ],

        [
            "[ number, number, string? ]",
            "[ number, number, (string | null)? ]"
        ],

        [
            "{ a: string, b: string? }",
            "{ a: string, b: (string | null) }"
        ],
        
        [
            "{ a: string, b?: string? }",
            "{ a: string, b?: (string | null) }"
        ]
        
    ]) {
        let input = testCase;
        let expectedOutput = testCase;
        
        if (Array.isArray(testCase)) {
            [ input, expectedOutput ] = testCase;
        }

        let ast = Parser.parse("let foo: " + input);
        
        let annotation = ast.body[0].declarations[0].id.annotation;
        let actualOutput = TypePrinter.print(annotation);
        
        assert.equal(expectedOutput, actualOutput);
    }
    
    // TypePrinter requires a Node of type Syntax.TSTypeAnnotation
    assert.throws(() => { TypePrinter.print(null); });
    assert.throws(() => { TypePrinter.print({ type: "Not_A_TSTypeAnnotation" }); });
});

