import { Parser } from "../../src/ast/Parser.js";
import { TypeParser } from "../../src/ast/TypeParser.js";
import assert from "node:assert";
import test from "node:test";


function testTypes()
{
    let types = [
        // Numeric literals
        "-5", "5", "3.14", "3e4",
        
        // String constants
        "'foo'", '"foo"',

        // Keyword/undefined
        "void", "null", "undefined",
        
        "this",
        "string", "number", "Foo",
        "string[]", "string[\n]",

        "(string)", "(\nnumber)",
        
        // Tuples
        "[ string, string ]",
        "[ string, string? ]",
        "[ string, ...string[] ]",
        
        // Object
        "{ a: string, b: string }",
        
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
        "typeof\nFoo",
        "readonly number[]",
        "readonly\nnumber[]",
        
        "() => void",
        "(a: string) => number",
        "(a: string, b: string) => number",
        "(a: string, b: string) \n=> number",
        "(a: string, b: string) =>\n number"
    ];

    for (let i = 0; i < types.length; i++) {
        for (let j = 0; j < types.length; j++) {
            let a = types[i];
            let b = types[j];
            
            let input = `function x(a: ${a}, b: ${a}): ${b} { let x: ${b} = null, y; }`;

            try {
                let program = Parser.parse(input);
                
                let decl = program?.body?.[0];
                let body = decl?.body?.body;
                
                assert(decl);
                assert(body);
                assert(decl.params[0]?.typeAnnotation);
                assert(decl.params[1]?.typeAnnotation);
                assert(decl.returnType);
                assert(body);
                assert(body[0].declarations.length == 2);
                assert(body[0].declarations[0].init.raw == "null");

            } catch (cause) {
                let err = new Error(`Error parsing: "${input}"`);

                err.cause = cause;
                err.input = input;
                err.inputAt = input.slice(cause.pos);

                throw err;
            }
        }
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
    test("Types", t => { testTypes(); });

//  Currently unsupported
//  test("Binding Patterns", t => { testBindingPatterns(); });
    
    test("Assertions", t => {
        let typeParser = new TypeParser({ ecmaVersion: 2022, locations: true });

        // TypeParser is an abstract class and doesn't implement these methods
        assert.throws(() => { typeParser.saveState();    });
        assert.throws(() => { typeParser.restoreState(); });
    });
});

