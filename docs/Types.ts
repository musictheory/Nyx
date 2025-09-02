/*
    This file is valid TypeScript as well as valid Nyx.

    It details which TypeScript type annotations are supported.
*/


function PrimitiveAndKeywordTypes()
{
    let x1:  any,
        x2:  boolean,
        x3:  bigint,
        x4:  never,
        x5:  null,
        x6:  number,
        x7:  object,
        x8:  string,
        x9:  symbol,
        x10: undefined,
        x11: unknown,
        x12: void;
}


function LiteralTypes()
{
    // Numeric literals
    let n1: -5,
        n2:  5,
        n3: 3.14,
        n4: 3e4,
        n5: 0b01,
        n6: 0x40,
        n7: 0o10;

    // String literals
    let s1: "foo",
        s2: 'foo';

    // Not supported: Template Literal Types
    // let x: `foo`;
}


function ArrayTypes()
{
    let x1: string[],
        x2: string[][],
        x3: Array<string>,
        x4: Array<Array<string>>;
}


/*
    Tuple Types

    Nyx uses 'x: string?' to indicate a nullable type (x may be 'null').

    TypeScript uses 'string?' to indicate an optional tuple member.
    
    To use a nullable type inside of a tuple, enclose it within parenthesis:
    
        let x: [ string, (string?), string? ]
    
        transpiles into:
    
        let x: [ string, (string|null), string? ]

    You may also use labelled tuple members:
    
        let x: [ string, foo: string?, bar?: string? ]
        
        transpiles into:
        
        let x: [ string, foo: (string|null), bar?: (string|null) ]
*/
function TupleTypes()
{
    let x1: [ ],
        x2: [ string, string ],
        x3: [ string, string? ],
        x4: [ string, ...string[] ],
        x5: [ x: number, y: number ],
        x6: [ x: number, y: number, z?: number ],
        x7: readonly [ number, number ];
}


function UnionAndIntersectionTypes()
{
    class Foo { foo() { } }
    class Bar { bar() { } }
    
    let x1: Foo | Bar,
        x2: Foo & Bar,
        x3: |Foo & Bar,
        x4: &Foo | Bar,
        x5: Foo | null,
        x6: Foo | Bar | null | undefined;
}


function FunctionTypes()
{
    class Foo { foo() { } }

    let x1: () => void,
        x2: (a: string) => number,
        x3: (a: string, b: string) => number,
        x4: (a: string, ...rest: number[]) => number,
        x5: (a: string, [ b, c ]: [ string, number ]) => number,
        x6: (a: string, { b, c }: { b: string, c: number }) => number;

    // Function type with type parameter
    let x7: <T>(x: T) => T;

    // Constructor type
    let x8:  new () => Foo;
}


function ThisType()
{
    class Foo {
        getSelf(): this { return this; }
    }
}


/*
    Object Types

    Nyx supports a limited form of TypeScript's object type
    with simple property/type pairs. Optional properties
    are supported.
*/
function ObjectTypes()
{
    let x1: { x: number, y: number },
        x2: { x: number, y: number, z?: number };

    // Index signatures and mapped types are not supported 
    // let x: { [ index: number]: string }

    // Method syntax is not supported
    // let x: { foo(x: number): string }

    // Call signatures are not supported
    // let x: { (someArg: number): boolean; }

    // Construct Signatures are not supported
    // let x: { new (s: string): Foo }
}


function GenericsAndTypeParameters()
{
    function  identity<T>(x: T): T { return x; }        // Function declaration
    const x = function<T>(x: T): T { return x; }        // Function expression
    
    class Foo { identity<T>(x: T): T { return x; } }    // Method definition

    class Wrapper<T> { value: T }                       // Class declaration
    const wrapper2 = class<T> { value: T }              // Class expression

    type StringWrapper = Wrapper<string>;               // Type declaration
    interface IFoo<T> { identity<T>(x: T): T }          // Interface declaration

    // Inheritance
    class StringWrapper2 extends Wrapper<string> { }

    // Using a generic with 'new'
    let stringWrapper = new Wrapper<String>();
    stringWrapper.value = "foo";

    // Interface declarations + variance annotations
    interface Consumer<in T> { consume: (x: T) => void; }
    interface Producer<out T> { make(): T; }
    interface ProducerConsumer<in out T> { consume: (x: T) => void; make(): T; }

    // Not supported: type parameters on object properties
    // const Foo2 = { identity<T>(x: T): T { return x; } }

    // Not supported: instantiation expressions
    // let StringWrapper = Wrapper<string>;
    // let x = new StringWrapper();

    // Not supported: type parameters in a call expression
    // let x = identity<string>("foo");
}


function GenericConstraints()
{
    function getProperty<Type, Key extends keyof Type>(obj: Type, key: Key) {
        return obj[key];
    }
}


function GenericParameterDefaults()
{
    class HTMLElement { }
    class HTMLDivElement extends HTMLElement { }
    class HTMLImageElement extends HTMLElement { };

    function create<
        T extends HTMLElement = HTMLDivElement,
    >(
        element?: typeof T,
    ): T {
        return new (element ?? HTMLDivElement)();
    }

    let divElement = create();
    let imageImage = create(HTMLImageElement);
}


function KeyofAndTypeofOperators()
{
    class Point { x: number; y: number };

    let x1: keyof Point,
        x2: typeof Point;
}


function IndexedAccessTypes()
{
    type Person = { age: number; name: string; alive: boolean };
    type Age = Person["age"];

    let x1: Age,
        x2: Person["age"];
}


function ConditionalTypes()
{
    interface Animal { live(): void; }
    interface Dog extends Animal { woof(): void; }
 
    let x1: Dog    extends Animal ? number : string,
        x2: RegExp extends Animal ? number : string;

    type Flatten<Type> = Type extends Array<infer Item> ? Item : Type;

    // Inferring Within Conditional Types
    type GetReturnType<Type> = Type extends (...args: never[]) => infer R ?
        R : never;
}


function AssertionFunctions()
{
    function isString(val: any): val is string {
        return (typeof val === "string")
    }

    function assert(yn: any): asserts yn {
        if (!yn) throw new Error("Assertion failed");
    }

    function assertIsString(val: any): asserts val is string {
        if (typeof val !== "string") throw new Error("Not String");
    }
}


// Not supported: Mapped Types
// type OptionsFlags<Type> = { [Property in keyof Type]: boolean; };


// Not supported: Template Literal Types
// let x: `foo`;
