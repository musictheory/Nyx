# Nyx

Nyx is a superset of the JavaScript language. It is the successor to [NilScript](https://github.com/musictheory/NilScript) and borrows features from TypeScript, Swift, and Objective-C.

### Quick Links

- [Language Features](#language-features)  
  - [Bundling](#bundling)
  - [Type Annotations](#type-annotations)
  - [Enums](#enums)
  - [Named Parameters](#named-parameters)
  - [Initializers](#initializers)
  - [Properties](#properties)
  - [Property Observers](#property-observers)
  - [String Interceptors](#string-interceptors)
  - [Target Tags](#target-tags)
  - [Globals](#globals)
- [Runtime API](#runtime-api)
- [Compiling Projects](#compiling-projects)
    - [Compiler Options](#compiler-options)
    - [Additional Compiler API](#additional-compiler-api)
    - [Multiple Output Files](#multiple-output-files)
    - [Squeezing Properties](#squeezing-properties)


## Restrictions

- All identifiers that start with `N$` (including `N$` itself) are classified as Reserved Words and may not be used.


## Language Features

### Bundling

Currently, Nyx is a non-standard bundler.

Nyx uses its own named `import` syntax without the `from "module-name"` clause:

```typescript
// A.nx
export class Foo { }

// B.nx
import { Foo };
let f = new Foo();
```

Nyx will perform dependency analysis and re-order input files as necessary. The output of each input file is wrapped in an [IIFE](https://developer.mozilla.org/en-US/docs/Glossary/IIFE) to isolate its scope. Ultimately, this is different from the ECMAScript module standard and may result in subtle behavior differences when dealing with cyclic dependencies.

*In the distant future, Nyx will either perform standards-compliant bundling itself, or it will delegate this task to an existing tool.*

### Type Annotations

For type-checking, Nyx borrows much of TypeScript's type annotation syntax.

Single-word types such as `string`, `void`, or `Foo` are passed directly to TypeScript.


#### The optional type

Nyx makes a single extension to TypeScript syntax: the optional type. A `?` character following a type transpiles to the union of that type with `null`.  For example, `string?` becomes `string | null`.

| Nyx Type | TypeScript Type                                                      
|----------|-----------------
| `string?` | `string \| null`
| `Foo[]?`  | `Foo[] \| null`
| `Foo?[]`  | `(Foo \| null)[]`

Nyx also supports [optional parameters](https://www.typescriptlang.org/docs/handbook/2/functions.html#optional-parameters), where a `?` character immediately follows the parameter name. An optional parameter with a type of `string` actually has the type of `string | undefined`.

| Declaration               | Type of `x`                                                    
|---------------------------|-------------
| `function f(x: string)`   | `string`
| `function f(x?: string)`  | `string \| undefined`
| `function f(x: string?)`  | `string \| null`
| `function f(x?: string?)` | `string \| null \| undefined`

While similar, both syntaxes are needed to support the subtle differences between `null` and `undefined`.


#### Object types

Nyx supports [object types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#object-types) as well as [optional properties](https://www.typescriptlang.org/docs/handbook/2/objects.html#index-signatures):

```typescript
let myPoint: {
    x: number,
    y: number,
    z?: number
} = { x: 1, y: 2};
```

Nyx does not support [index signatures](https://www.typescriptlang.org/docs/handbook/2/objects.html#index-signatures), [call signatures](https://www.typescriptlang.org/docs/handbook/2/functions.html#call-signatures), or [construct signatures](https://www.typescriptlang.org/docs/handbook/2/functions.html#construct-signatures).


#### Tuple types

Nyx supports [tuple types](https://www.typescriptlang.org/docs/handbook/2/objects.html#tuple-types):

```typescript
let tuple:  [ number, string  ];
let tuple2: [ number, string? ];
let tuple3: [ number, string, ...boolean[] ];
```

Nyx does not support [labeled tuple elements](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-0.html#labeled-tuple-elements).


#### Generics

Nyx supports type arguments such as `Map<string, Foo>`, `Set<Foo>`, and `Promise<Foo>`.

Nyx does not support declaring [generic types](https://www.typescriptlang.org/docs/handbook/2/objects.html#generic-object-types) or [generic functions](https://www.typescriptlang.org/docs/handbook/2/functions.html#generic-functions). In other words: while Nyx may use generics defined in external `.d.ts` files, it currently does not support defining its own in `.nx` files.


#### Other types

In addition, Nyx supports the following TypeScript types:

| Annotation          | Notes                                                      
|---------------|------------------------------------------------------------------
| `Foo[]`
| `Foo[][]`
| `Foo \| Bar`
| `Foo & Bar`
| `readonly Foo`
| `typeof Foo`
| `"string"`    | *No support for template string literals*
| `-42`        
| `(a: string) => void` | See [Function Type Expressions](https://www.typescriptlang.org/docs/handbook/2/functions.html#function-type-expressions) 

#### Additional TypeScript Features

Nyx provides basic support for [Type Aliases](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-aliases), [Interfaces](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#interfaces), [Type Assertions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions), [readonly fields](https://www.typescriptlang.org/docs/handbook/2/classes.html#readonly), and the postfix `!` operator.

The following is valid Nyx code:

```typescript
type MyNumberOrString = number | string;

interface ExampleInterface {
    foo: string;
    bar?: string;
    doFoo(): void;
};

function f1(x: MyNumberOrString, isString: boolean): void {
    if (isString) {
        let y = x as string; // y is type 'string'
        …
    } else {
        let y = x as number; // y is type 'number'
        …
    }
}

function f2(x?: number): void {
    let y = x!; // y is type 'number'
    …
}
```

### Enums

Nyx supports C-style enumerations via the `enum` keyword.

When the first enum member is uninitialized, it is given a value of `0`. Subsequent uninitialized members are assigned an auto-incremented value.

```typescript
enum ExampleEnum {
    Zero,
    One,
    Two,
    Five = 5,
    Six
};

let x = ExampleEnum.Two; // x is 2
let y = ExampleEnum.Six; // y is 6
```

String enums may also be used:

```typescript
enum StringEnum {
    Zero = "Zero",
    One  = "One",
    Two  = "Two"
}

let x = StringEnum.One; // x is "One" 
```

While this syntax is similar to [TypeScript Enums](https://www.typescriptlang.org/docs/handbook/enums.html), Nyx enums are always inlined &mdash; a Nyx `enum` is the equivalent of a TypeScript `const enum`. As such, only constant enum members are allowed.


### Named Parameters

Nyx borrows the `func` keyword from [Swift](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/functions/). This enables methods to have named parameters.

```typescript
class Greeter {
    func greet(person: string): string {
        return `Hello, ${person}!`;
    }   
}

let greeter = new Greeter();

// Prints "Hello, Bob!"
console.log(greeter.greet(person: "Bob")); 
```

Function parameters may have different argument labels:

```typescript
class Foo {
    func someFunction(argumentLabel parameterName: number) {
        // Inside the function body, use parameterName to reference the parameter
        // When calling this method, use foo.someFunction(argumentLabel: 42);
    }
}
```

To extend the first example:

```typescript
class Greeter {
    func greet(person: string, from hometown: string): string {
        return `Hello ${person} from ${hometown}!`;
    }   
}

let greeter = new Greeter();

 // Prints "Hello, Bob from Livermore!"
console.log(greeter.greet(person: "Bob", from: "Livermore"));
```

As in Swift, argument labels may be blank by using an underscore (`_`).

```typescript
class Foo {
    func someFunction(_ firstParameterName: number, secondParameterName: number) {
    
    }
}

let foo = new Foo();
foo.someFunction(1, secondParameterName: 2);
```

Rest parameters and binding destructuring patterns are not supported by `func` methods. For these, use a standard class method.


### Initializers

Nyx supplements JavaScript's [constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/constructor) method with its own initialization system. This enables argument labels to be used with `new()`:

```typescript
let button = new Button(title: "My Button", color: "#fff")
```

The above code will construct a new `Button` instance and then call `init(title:color:)` on it:

```typescript
func init(title: string, color: string) {
    // perform some initialization here
}
```

The `init` method may also be specified without argument labels:

```typescript
class Foo {
    func init(_ n: number) {
        if (n === undefined) {
            console.log("no arg");
        } else {
            console.log("arg: " + n);
        }
    }

    func init(string: string) {
        console.log("string: " + string);
    }
}

let f1 = new Foo();              // Logs "no arg"
let f1 = new Foo(42);            // Logs "arg: 42"
let f2 = new Foo(string: "Moo"); // Logs "string: Moo"
```

#### Behind The Scenes: Initializers

When `new()` is used with argument labels, Nyx prepends `Nyx.namedInitSymbol` and the method name to the parameter list.


For example:

```
new Button(title: "My Button", color: "#fff")
```

is transpiled into:

```
new Button(Nyx.namedInitSymbol, "N$f_init_title_color", "My Button", "#fff");
```

Nyx adds a special `constructor` to handle this symbol and method name. For compatibility with plain JavaScript, this constructor is only added under the following conditions:

1. The class does not specify a `constructor` method.
2. The class includes a `func` or a `prop`.

This constructor does the equivalent of:

```typescript
constructor(a0, a1, ...rest)
{
    if (a0 === Nyx.namedInitSymbol) {
        // Change namedInitSymbol->noInitSymbol. This prevents
        // super() from calling dispatchInit before our own
        // fields are initialized.
        //
        super(Nyx.noInitSymbol, a1, ...rest);

        // Handle init now that super() has returned
        Nyx.dispatchInit(this, a0, a1, ...rest);

    } else if (a0 === Nyx.noInitSymbol) {
        // Pass unchanged parameters to super
        super(a0, a1, ...rest);

        // dispatchInit will be called by the subclass.
        return;

    } else {
        // Append Nyx.noInitSymbol and a blank string.
        super(Nyx.noInitSymbol, "", a0, a1, ...rest);

        // Handle init
        Nyx.dispatchInit(this, a0, a1, ...rest);
    }
}
```

`Nyx.dispatchInit()` does the equivalent of:

```typescript
function dispatchInit(instance, symbol, initMethod, ...args)
{
    if (symbol === Nyx.noInitSymbol) {
        return;
    } else if (symbol === Nyx.namedInitSymbol) {
        instance[initMethod](...args);
    } else {
        instance.init?.(...args);
    }

    instance[Nyx.postInitSymbol]?.();
}
```

While this logic is a bit complicated, it is necessary to ensure that the `init` method is only called once, and that it is only called after all class fields are initialized.

It's possible for a Nyx class to `extend` a plain JavaScript class, but a special `constructor` must be used to handle the `Nyx.noInitSymbol` and `Nyx.namedInitSymbol` cases:

```typescript
class MyArray extends Array {
    constructor(a0, a1, ...rest) {
        if (a0 === Nyx.noInitSymbol) {
            return super(...rest);
        } else if (a0 === Nyx.namedInitSymbol) {
            super(...rest);
        } else {
            super(a0, a1, ...rest);
        }
    
        Nyx.dispatchInit(this, a0, a1, ...rest);
    }
    
    init(number: number, times: number) {
        for (let i = 0; i < times; i++) {
            this.push(i);
        }
    }
}

let arr1 = new MyArray(1, 2, 3);             // [ 1, 2, 3 ]
let arr2 = new MyArray(number: 2, times: 3); // [ 2, 2, 2 ]
```

#### Post-initializers

In specific situations, you may need to run additional configuration code *after* Nyx initialization takes place. `Nyx.postInitSymbol` enables this:

```typescript
import { Nyx };

class View {
    func init() { … }
    
    [ Nyx.postInitSymbol ]() {
        this.initSubviews();
    }
    …
}

class Button extends View {
    func init() { super.init(); … }

    // Will be called after Button.init and View.init runs
    func initSubviews(): void {
        …  
    }
    …
}
```


### Properties

Nyx borrows the concept of properties from Objective-C and implements them via the `prop` keyword.

Declaring a `prop` named `propName`:

1. Generates a private class field `#propName`
2. Generates `get propName()` and `set propName()` accessor methods
3. Enables the use of a special shortcut identifier (`_propName`) which transpiles to `this.#propName`

For example:

```typescript
class Foo {
    prop bar: string?;
    clearBar() { _bar = null; }
}
```

Transpiles into:

```typescript
class Foo {
    #bar;
    set bar(b) { this.#bar = b; }
    get bar()  { return this.#bar; }
    clearBar() { this.#bar = null; }
}
```

If a property is declared `readonly`, only the `get` accessor is generated.
If a property is declared `private`, neither accessor is generated.
In all cases, the backing class field is generated and the shortcut identifier is enabled.

```typescript
class Foo {
    private prop a: number;
    readonly prop b: number;
    getTotal() { return _a + _b; }
}
```

Transpiles into:

```typescript
class Foo {
    #a;
    #b;
    get b() { return this.#b; }
    getTotal() { return this.#a + this.#b; }
}
```


#### Property Observers

In our internal UI frameworks, it's common to call `setNeedsDisplay()` or `setNeedsLayout()` in response to a property change.  For example, our Button class needs a redraw when the corner radius changes:

```typescript
class Button extends View {
    prop cornerRadius: number;

    set cornerRadius(radius: number): void {
        if (_cornerRadius != radius) {
            _cornerRadius = radius;
            this.setNeedsDisplay();
        }
    }

    …
}
```

Using `prop` observers, we can instead write:

```typescript
class Button extends View {
    @display prop cornerRadius: number;
    …
}
```

A bit of setup is required to enable `prop observers`. First, the `observers` option needs to be passed into the compiler:

```javascript
/* This code block is a Compiler API example. */

let options = {
    …,
    "observers": { "display": "D", "layout": "L", "update": "U" }
};
```

This enables the use of `@display`, `@layout`, and `@update` as `prop` observers.
When a `@display` `prop` changes, the `[ Nyx.observerSymbol ]` method is called
with a `"D"` argument. `@layout` and `@update` will use a `"L"` or `"U"` argument,
respectively. 

Next, we declare `[ Nyx.observerSymbol ]` as such:

```typescript
import { Nyx };

class View {
    [ Nyx.observerSymbol ](observerArg: string) {
        if (observerArg == "D") {
            this.setNeedsDisplay();
        } else if (observerArg == "L") {
            this.setNeedsLayout();
        } else if (observerArg == "U") {
            this.setNeedsUpdate();
        } else {
            throw new Error(`Unknown observer argument: ${observerArg}`);
        }
    }
}
```

The observers can now be used. The following example:

```typescript
class Button extends View {
    @display prop cornerRadius: number;
    @layout prop padding: number;
    @update prop title: string;
    …
}
```

will generate the following accessors:

```typescript
set cornerRadius(arg) {
    if (this.#cornerRadius != arg) {
        this.#cornerRadius = arg;
        this[Nyx.observerSymbol]("D"); // Will call setNeedsDisplay()
    }
}

set padding(arg): void {
    if (this.#padding != arg) {
        this.#padding = arg;
        this[Nyx.observerSymbol]("L"); // Will call setNeedsLayout()
    }
}

set title(arg) {
    if (this.#title != arg) {
        this.#title = arg;
        this[Nyx.observerSymbol]("U"); // Will call setNeedsUpdate()
    }
}
```


### String Interceptors

In our source base, we frequently need to minify/obfuscate/transform strings. The most common examples include CSS class names and log messages.

String interceptors enable these transformations. An interceptor shares the same syntax as a [tagged template](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates). However, instead of calling a function at runtime, it is transformed at compile-time into another string.

For example, by assigning interceptors to `C` and `L`, we can transform the following:

```typescript
let element = document.createElement("div");
element.classList.add(C`Button-outer-container`);

console.log(L`Created the button's outer element!`);
```

into:

```typescript
let element = document.createElement("div");
element.classList.add("ObfuscatedClass1");

console.log("#Log1#");
```


#### Example Log Obfuscator

To demonstrate this, let's create an interceptor to obfuscate log messages. The following rules will apply:

1. String interpolation may be used.
2. Any portion of the log message with words is obfuscated.
3. Any portion with only punctuation/spacing is left intact.

We will set the `"interceptors"` object in the [Compiler Options](#compiler-options) as follows:


```javascript
/* This code block is a Compiler API example. */

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

let options = {
    …,
    "interceptors": { "L": interceptLogMessage }
};

let compiler = new Nyx.Compiler();
let result = await compiler.compile(options);
```

This compiler will transform the following Nyx code:

```
// p1 and p2 are points of type '{ x: number, y: number }'
console.log(L`Drawing from point ${p1.x}, ${p1.y} to ${p2.x}, ${p2.y}."
```

into:

```
// p1 and p2 are points of type '{ x: number, y: number }'
console.log(`#Log1#${p1.x}, ${p1.y}#Log2#${p2.x}, ${p2.y}.`);
```


### Target Tags

Target Tags enable portions of a codebase to be kept or removed at compile time. We use them to remove Web-only code from our app target and App-only code from our web target.

A target tag shares the same syntax as a decorator and can be applied to a class declaration or a class `func`. At compile time, a target tag is set to either `true` or `false`. When `false`, Nyx will remove the marked class or `func`.

For example, we could use these compiler options and code:

```javascript
/* This code block is a Compiler API example. */

let options = {
    …,
    "target-tags": { "desktop": true, "mobile": false }
};
```

```typescript
// In ButtonImpl.nx
@desktop export class ButtonDesktopImpl extends ButtonImpl { … }
@mobile  export class ButtonMobileImpl  extends ButtonImpl { … }

// In Button.nx
import { ButtonDesktopImpl, ButtonMobileImpl };

class Button {
    …
    _makeImpl(): ButtonImpl {
        if (ButtonDesktopImpl) {
            return new ButtonDesktopImpl();
        } else if (ButtonMobileImpl) {
            return new ButtonMobileImpl();
        } else {
            throw new Error("No ButtonImpl exists for this target.")
        }
    }
}
```

When type checking, a class marked with a target tag has its type unioned with `undefined`. Trying to instantiate it directly will result in a TypeScript warning:

```typescript
@target class Foo { … }

let foo1 = new Foo(); // ts(18048): 'Foo' is possibly 'undefined'.

// No warnings, foo2 will be of type 'Foo | null'
let foo2 = Foo ? new Foo() : null;
```

### Globals

Nyx supports globals via the `global` keyword. A global may be used in any file without the use of `import`.

A globals must be a constant string or number and is inlined at compile time.

For example:

```typescript
// Foo.nx
global const FOO_GLOBAL = "Foo";

// Bar.nx
global const BAR_GLOBAL = 42;

// Baz.nx
assert(FOO_GLOBAL == "Foo");
assert(BAR_GLOBAL == 42);
```

Transpiles into:

```typescript
// Foo.nx
// Line removed

// Bar.nx
// Line removed

// Bar.nx
assert("Foo" == "Foo");
assert(42 == 42);
```

Globals may also be defined via compiler options:

```javascript
/* This code block is a Compiler API example. */

let options = {
    …,
    "global-consts": {
        "FOO_GLOBAL": "Foo",
        "BAR_GLOBAL": 42
    }
};
```

### Legacy Features

`legacy prop`

- Definitely goes away.
- Generates underscore-prefixed field.
- `observed` modifier

`global function`
- Should we keep this?
- If we don't keep, should `global const` and the `global-consts` option be renamed to `global`/`globals`?


## Runtime API

Nyx includes a small runtime API for advanced situations. It can be accessed via `import { Nyx };`

| API | Notes
|-|-
| **Nyx.dispatchInit()** <br> **Nyx.noInitSymbol** <br> **Nyx.namedInitSymbol** | Used in initialization. See [Behind The Scenes: Initializers](#behind-the-scenes-initializers).
| **Nyx.postInitSymbol** | Used by [Post-initializers](#post-initializers).
| **Nyx.observerSymbol** | Used by [Property Observers](#property-observers).

**Nyx.getFuncIdentifier()**

To access a `func` via bracket notation, use `Nyx.getFuncIdentifier` with a constant string. For example:

```
import { Nyx };

class Logger {
    func log(foo: string, bar: string) {
        console.log(`A: #{foo}, #{bar}`);
    }
    func log(_ foo: string, bar: string) {
        console.log(`B: #{foo}, #{bar}`);
    }
}

let logger = new Logger();

let propertyName = Nyx.getFuncIdentifier("log(foo:bar:)");
logger[propertyName]("1", "2"); // Prints "A: 1, 2"

let propertyName2 = Nyx.getFuncIdentifier("log(_:bar:)");
logger[propertyName]("1", "2"); // Prints "B: 1, 2"
```


## Compiling Projects

For basic usage, call `nyx.compile()` with [compiler options](#compiler-options):


```javascript
/* This code block is a Compiler API example. */

let nyx = require("nyx");

let options = { … };

async function doCompile() {
    let results = nyx.compile(options);
    let { code, warnings, errors } = results;
    … // Do something with results
}
```

To enable incremental compiles, or for [multiple output files](#multiple-output-files); create a `Compiler` object and then call `compile()` on it:

```javascript
/* This code block is a Compiler API example. */

let nyx = require("nyx");

let compiler = new nyx.Compiler();

let options = { … };

// Call doCompile() each time one of the files specified
// by options.files changes
async function doCompile() {
    let results = compiler.compile(options);
    let { code, warnings, errors } = results;
    … // Do something with results
}
```


### Compiler Options

Below is a list of supported properties for `options` and `results`.

Valid properties for the `options` object:

Key                       | Type     | Description
------------------------- | -------- | ---
files                     | Array    | Strings of paths to compile, or Objects of `file` type (see below)
prepend                   | string   | Content to prepend, not compiled or typechecked
append                    | string   | Content to append, not compiled or typechecked
include-map               | boolean  | If true, include `map` key in results object
source-map-file           | string   | Output source map file name
source-map-root           | string   | Output source map root URL
before-compile            | Function | Before-compile callback (see below)
after-compile             | Function | After-compile callback (see below)
squeeze                   | boolean  | If true, enable squeezer
squeeze-start-index       | number   | Start index for squeezer
squeeze-end-index         | number   | End index for squeezer
squeeze-builtins          | string[] | Array of builtins for squeezer
check-types               | boolean  | If true, enable type checker
defs                      | Array    | Additional typechecker definition files (same format as `files`)
typescript-lib            | string   | Built-in type declarations (`tsc --lib`)

Valid properties for each `file` or `defs` object:

Key      | Type    | Description
-------- | ------- | ---
path     | string  | Path of file     
contents | string  | Content of file                                                  |     
time     | number  | Modification time of the file (ms since 1970)                    |

Properties for the `results` object:

Key     | Type    | Description
------- | ------- | ---
code    | string  | Compiled JavaScript source code
map     | string  | Source map (if `include-map` is true)
squeeze | Object  | Map of squeezed identifiers to original identifiers.  See [Squeezing Properties](#squeezing-properties) below.


The `before-compile` key specifies a callback which is called prior to the compiler's Nyx&rarr;JavaScript stage.  This allows you to preprocess files.  The callback must return a Promise. Once the promise is resolved, a file's content must be valid Nyx or JavaScript.

The `after-compile` key specifies a callback which is called each time the compiler generates JavaScript code for a file.  This allows you to run the generated JavaScript through a linter (such as [ESLint](http://eslint.org)). The callback must return a Promise. When this callback is invoked, a file's content will be valid JavaScript.


```javascript
/* This code block is a Compiler API example. */

// Simple preprocessor example.  Strips out #pragma lines and logs to console
options["before-compile"] = async file => {
    let inLines = file.getContents().split("\n");
    let outLines = [ ];

    inLines.forEach(line => {
        if (line.indexOf("#pragma") == 0) {
            console.log("Pragma found in: " + file.getPath());

            // Push an empty line to maintain the same # of lines
            outLines.push("");

        } else {
            outLines.push(line);
        }
    });
    
    file.setContents(outLines.join("\n"));
};

// ESLint example
options["after-compile"] = async file => {
    if (!linter) linter = require("eslint").linter;

    // getContents() returns the generated source as a String
    _.each(linter.verify(file.getContents(), linterOptions), function(warning) {
        // addWarning(line, message) adds a warning at a specific line
        file.addWarning(warning.line, warning.message);
    });
};
```

### Additional Compiler API


#### nyx.getRuntimePath

#### nyx.generateBuiltins

Generates an array of built-in identifiers for use with the squeezer. See [Generating Built-ins](#generating-built-ins).

#### nyx.symbolicate

```typescript
symbolicate(
    identifier: string,
    squeezed?: Record<string, string>
): string
```

Converts an internal Nyx identifier such as `N$f_foo_bar_baz` to a human-readable string (`"foo(bar:baz:)"`). The optional `squeezed` argument may be specified to handle squeezed properties (see [Symbolicating Squeezed Properties](#symbolicating-squeezed-properties)).

#### nyx.tuneTypecheckerPerformance

To improve type checker performance, Nyx includes a `tuneTypecheckerPerformance` API:

`nyx.tuneTypecheckerPerformance(includeInCompileResults, workerCount)`

Key                       | Type     | Default |
------------------------- | -------- | ------- |
includeInCompileResults   | boolean  | `true`  |
workerCount               | number   | `4`     |

When `includeInCompileResults` is `true`, Each call to `Compiler.prototype.compile()` will wait for its associated type checker to finish. Type checker warnings are then merged with `results.warnings`.

When `includeInCompileResults` is `false`, `Compiler.prototype.compile()` will start the type checker but not wait for it to finish. Warnings are accessed via the `Promise` returned from `Compiler.prototype.collectTypecheckerWarnings()`. In complex projects with several `Compiler` objects, this option can result in faster compile times.

`workerCount` sets the number of node `worker_threads` used to run TypeScript compilers.

### Multiple Output Files

The simplest way to use Nyx is to pass all `.nx` and `.js` files in your project into `nyx.compile()` and produce a single `.js` output file.  In general: the more files you compile at the same time, the easier your life will be.  However, there are specific situations where a more-complex pipeline is needed.

In our usage, we have two output files: `core.js` and `webapp.js`.

`core.js` contains our model and model-controller classes.  It's used by our client-side web app (running in the browser), our server-side backend (running in node/Express), and our iOS applications (running in a JavaScriptCore JSContext).

`webapp.js` is used exclusively by the client-side web app and contains HTML/CSS view and view-controller classes. `webapp.js` needs to allocate classes from `core.js`.

To build these two files, we use two `Compiler` instances and then link them using the `Compiler.prototype.uses()` API.

```javascript
/* This code block is a Compiler API example. */

import nyx from "nyx";
import fs  from "node:fs/promises";

let coreCompiler   = new nyx.Compiler();
let webAppCompiler = new nyx.Compiler();
    
let coreOptions   = { … };
let webAppOptions = { … };

// This tells webAppCompiler to use state from coreCompiler 
//
// It's your responsibility to watch files for changes
// and kick off compileCoreJS() or compileWebAppJS().
//
// Note: A change to a core file needs to call *both*
// compileCoreJS() *and* compileWebAppJS().
// 
// In practice, you would use a build system, set up two tasks,
// and have the "webapp" task depend on the "core" task.
// 
webAppCompiler.uses(coreCompiler);

// Call this when a core file changes
async function compileCoreJS() {
    let result = await coreCompiler.compile(coreOptions);
    await fs.writeFile("core.js", result.code);
}

// Call this when a web app file changes.
async function compileWebAppJS() {
    let result = await webAppCompiler.compile(webAppOptions);
    await fs.writeFile("webapp.js", result.code);
}
```

In the above example:

1. All lower-level `.js` and `.nx` files are passed into `coreCompiler` via `coreOptions`.
2. The compiler products a `result` object. `result.code` is saved as `core.js`.
3. All higher-level `.js` and `.nx` files are passed into `webAppCompiler`.  `webAppCompiler` pulls state from `coreCompiler` due to the `Compiler.uses` API.
4. The `result.code` from this compilation pass is saved as `webapp.js`.
5. Both `core.js` and `webapp.js` are included (in that order) in various HTML files via `<script>` elements.

### Squeezing Properties

Nyx includes a "squeezer" which converts property names into obfuscated identifiers like `N$abc` . This is similar to the `mangle.properties` option of [Terser](https://terser.org/) or [UglifyJS](https://github.com/mishoo/UglifyJS).

To enable the squeezer, pass `true` to the `squeeze` option.

Each time the squeezer finds a new property, it increments an internal counter called the index. The property name is then replaced by an identifier consisting of `N$` followed by `Base62(index)`.

*Note: the squeezer only transforms properties and not class names, parameter names, or variable names. It is assumed that production code will be ran through [Terser](https://terser.org/) or a similar minifier.* 


If you are generating [multiple output files](#multiple-output-files), each file must use a unique numeric range for the squeezer index. This range is specified via `squeeze-start-index` and `squeeze-end-index`.

#### Symbolicating Squeezed Properties

After compilation, the `compile()` results object will contain a `squeezed` property. This is a plain JSON object mapping squeezed identifiers to their original property names. You may pass this object into the `symbolicate()` API:

```javascript
/* This code block is a Compiler API example. */

let results = await nyx.compile({
    input: { "class Foo { foo() { } bar() { } }")
    squeeze: true
});

console.log(results.squeezed);
// Output is similar to: { 'N$e': 'foo', 'N$b': 'bar' }

nyx.symbolicate("N$e and N$b", results.squeezed);
// Output is 'foo and bar'
```

#### Generating Built-ins

Nyx does not maintain its own list of built-in JavaScript or DOM property names. Instead, clients must specify a list of strings via the `squeeze-builtins` option.

Nyx includes the `nyx.generateBuiltins()` API to generate this list from TypeScript's `.d.ts` files.

This API takes a single `options` argument as follows:

|Option|Type|Description
|-|-|-
`typescript-target` | `string` | Passed to TypeScript as `target`
`typescript-lib` | `string[]` | Passed to TypeScript as `lib`
`defs` | `string[]` | Additional `.d.ts` files
`unused-interfaces` | `(string\|RegExp)[]` | Used to skip specified `interface` declarations.

`generateBuiltins()` uses the `ts.createProgram()` TypeScript API to create a small program from the passed-in options. It then traverses each `.d.ts` file.

The name of each `interface` declaration is compared (via `String.prototype.match`) to each element of `unused-interfaces`.

If a match occurs, the `interface` is skipped. If no match occurs, all identifiers contained in the `interface` are added to the result.

For example, if a project:

- Is a web app targeting EcmaScript 2022.
- Specifies additional definitions in `myDefs.d.ts`.
- Does not use [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API), [MathML](https://developer.mozilla.org/en-US/docs/Web/MathML), or [Geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API).

We would use the following options:

```javascript
/* This code block is a Compiler API example. */

let nyx = require("nyx");

let builtins = await nyx.generateBuiltins({
    "typescript-target": "2022",
    "typescript-lib": [ "2022", "dom" ],
    "defs": [ "myProject/myDefs.d.ts" ],
    "unused-interfaces": [
        /^WebGL/, /^WEBGL/, /^OES_/, /^OVR_/, // WebGL
        /^MathML/, /^Geolocation/
    ]
})
```


## Acknowledgements

Nyx uses [Acorn](https://github.com/acornjs/acorn) for parsing and [TypeScript](http://www.typescriptlang.org) for type checking.
Nyx's `TypeParser` class is heavily based on [acorn-typescript](https://github.com/TyrealHu/acorn-typescript).

## License

runtime.js is public domain.

All other files in this project are licensed under the [MIT license](http://github.com/musictheory/Nyx/raw/main/LICENSE.MIT).

