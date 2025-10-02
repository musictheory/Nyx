import { Parser     } from "../../src/ast/Parser.js";
import { TypeParser } from "../../src/ast/TypeParser.js";
import { Traverser  } from "../../src/ast/Traverser.js";

import assert from "node:assert";
import test from "node:test";

Error.stackTraceLimit = 50;


const SupportedTypeAnnotations = [
    // Numeric literals
    "-5", "5", "3.14", "3e4",
    
    // String constants
    "'foo'", '"foo"',

    // Keywords
    "any", "boolean", "bigint", "never", "null",
    "never", "number", "object", "string",
    "symbol", "undefined", "unknown", "void",
    
    "this",
    "Foo",
    "string[]", "string[\n]",

    // Tuples
    "[ ]",
    "[ string, string ]",
    "[ string, string? ]",
    "[ string, ...string[] ]",
    "[ start: number, end: number ]",
    
    // Object
    "{ a: string, b: string }",

    // Types in parenthesis
    "(string)", "(\nnumber)", "(5)",
    "([ string? ])",
    "({ a: string? })",
    
    // Intersection / Union
    "Foo | null",
    "Foo | Bar", "Foo & Bar",
    "Foo\n| Bar", "Foo &\nBar",
    "|Foo&Foo",  "&Foo|Bar",

    "Foo<A>", "Foo<A, B>",
    "Foo<Bar<A>, B>",
    "Foo<Bar<Baz<A>,B>,C>",
    "Foo<Bar<A,B>>",
    "Foo<Bar<Baz<A,B,C>>>",
    
    "typeof Foo",
    "typeof Foo.bar",
    "typeof Foo<string>",
    "typeof\nFoo",
    "readonly number[]",
    "readonly\nnumber[]",
    
    "() => void",
    "(a: string) => number",
    "(a: string, b: string) => number",
    "(a: string, b: string) \n=> number",
    "(a: string, b: string) =>\n number",
    "(a: string, b?: string) =>\n number",

    "(a: string, ...rest) => number",
    "(a: string, [ b, c ]) => number",
    "(a: string, { b, c }) => number",
    "(a: string, { b: b2, c: c2 }) => number",
    "(a: string, [ b, c ]: [ number, number ]) => number",
    "(a: string, { b, c }: { b: number, c: number }) => number",

    "([,]) => void",
    
    "new () => Foo"
];

const UnsupportedTypeAnnotations = [
    // Import type
    'import("foo")',
    
    // Typeof with import
    'typeof import("foo")'
];

const InvalidTypeAnnotations = [
    "[ x.y.z: number, number ]",
    "(a, !) => void",
    "[ , ]",
    "[ null null ]",
    "-foo",
    "+42",
    "Foo<>"
];


const SupportedTypePredicates = [
    "this is Foo",
    "x is boolean",
    "asserts x",
    "asserts this is Foo"
];


const InvalidTypePredicates = [
    "asserts 42"
];


function parseAndTraverse(input, callback)
{
    let ast;

    try {
        ast = Parser.parse(input);

        assert(ast);
        assert(ast.body);
        assert(ast.body[0]);

        callback(ast.body[0]);

    } catch (cause) {
        let err = new Error(`Error parsing: "${input}"`);

        err.cause = cause;
        err.input = input;
        err.inputAt = input.slice(cause.pos);

        throw err;
    }

    try {
        let traverser = new Traverser(ast);
        traverser.traverse(() => { });

    } catch (cause) {
        let err = new Error(`Error traversing: "${input}"`);

        err.cause = cause;
        err.input = input;
        err.inputAt = input.slice(cause.pos);
        
        throw err;
    }
}


function testTypeAnnotations(annotations)
{
    for (let i = 0; i < annotations.length; i++) {
        for (let j = 0; j < annotations.length; j++) {
            let a = annotations[i];
            let b = annotations[j];
            
            let input = `function x(a: ${a}, b: ${a}): ${b} { let x: ${b} = null, y; }`;

            parseAndTraverse(input, decl => {
                let body = decl.body?.body;

                assert(decl.params[0]?.typeAnnotation);
                assert(decl.params[1]?.typeAnnotation);
                assert(decl.returnType);
                assert(body);
                assert(body[0].declarations.length == 2);
                assert(body[0].declarations[0].init.raw == "null");
            });
        }
    }
}


function testTypePredicates(predicates)
{
    for (let i = 0; i < predicates.length; i++) {
        let a = predicates[i];
        let input = `function x(x): ${a} { let y = null; }`;

        parseAndTraverse(input, decl => {
            let body = decl.body?.body;

            assert(decl.returnType);
            assert(body);
            assert(body[0].declarations.length == 1);
            assert(body[0].declarations[0].init.raw == "null");
        });
    }
}


/* Currently unsupported

function testBindingPatterns()
{
    let lines = [
        "function x({ a, b = 42 }: { a : string, b: number }) { }",
        "function x([ a, b = 42 ]: [ a : string, b: number ]) { }"
    ];

    for (let line of lines) {
        try {
            let program = Parser.parse(line);
                
            let decl = program?.body?.[0];
            let body = decl?.body?.body;
                    
            assert(decl);
            assert(body);
            assert(decl.params[0]?.typeAnnotation);

        } catch (cause) {
            let err = new Error(`Error parsing: "${line}"`);

            err.cause = cause;
            err.input = line;
            err.inputAt = line.slice(cause.pos);

            throw err;
        }
    }
}
*/


test.suite("TypeParser", () => {
    test("Annotations", t => { testTypeAnnotations( SupportedTypeAnnotations ); });
    test("Predicates",  t => { testTypePredicates(  SupportedTypePredicates  ); });

    test("Unsupported/Invalid", t => {
        for (let a of [ ...UnsupportedTypeAnnotations, ...InvalidTypeAnnotations ]) {
            assert.throws(() => { Parser.parse(`let x: ${a}`); }, `'${a}'`);
        }

        for (let p of [ ...InvalidTypePredicates ]) {
            assert.throws(() => { Parser.parse(`function x(): ${p} { }`); }, `'${p}'`);
        }
    });

//  Currently unsupported
//  test("Binding Patterns", t => { testBindingPatterns(); });
    
    test("Assertions", t => {
        let typeParser = new TypeParser({ ecmaVersion: 2022, locations: true });

        // TypeParser is an abstract class and doesn't implement these methods
        assert.throws(() => { typeParser.saveState();    });
        assert.throws(() => { typeParser.restoreState(); });
    });
});

