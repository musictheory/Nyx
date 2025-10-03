/*
    SymbolUtils.js
    (c) 2013-2025 musictheory.net, LLC
    MIT license, http://www.opensource.org/licenses/mit-license.php

    Converts identifiers to/from compiler symbols
*/


const RootVariable = "N$$_";
const FuncPrefix   = "N$f_";


/*
    getImportExpression()
    
    Input: "TheImport"
    Output: "N$$_.$.N$i_TheImport"
*/
function getImportExpression(name, squeezer)
{
    let identifier = getImportIdentifier(name, squeezer);
    return `${RootVariable}.$.${identifier}`;
}


/*
    getImportIdentifier()
    
    Input: "TheImport"
    Output: "N$i_TheImport"
*/
function getImportIdentifier(name, squeezer)
{
    let result = `N$i_${name}`;
    if (squeezer) result = squeezer.squeeze(result);
    return result;
}


/*
    getDebugIdentifier()

    Used to obfuscate identifiers in debug strings. Used by
    Undefined Guards.
    
    Input: "NameToNotLeak"
    Output: "N$d_NameToNotLeak"
*/
function getDebugIdentifier(name, squeezer)
{
    let result = `N$d_${name}`;
    if (squeezer) result = squeezer.squeeze(result);
    return result;
}


/*
    getTypePlaceholder()

    Used in generated TypeScript when a `prop` lacks an annotation.
    See https://github.com/musictheory/Nyx/issues/10
    
    Input: "theProperty"
    Output: "N$t_theProperty"
*/
function getTypePlaceholder(name, squeezer)
{
    let result = `N$t_${name}`;
    if (squeezer) result = squeezer.squeeze(result);
    return result;
}


/*
    toFuncName()
    
    Converts a basename + argument labels into a mangled name.
    
    All components are escaped per the following rules:
    1. Each '_' is replaced with '$_' in the mangled name.
    2. Each '$' is replaced with '$$' in the mangled name.
    3. A '_' without a preceding '$' is used as a separator.
    4. 'N$f_' is used as a prefix.
    5. A '' string is used to indicate a missing label.
      
    Input: { base: "foo", labels: [ "bar", "baz" ] }
    Output: "N$f_foo_bar_baz"

    Input: { base: "_foo", labels: [ "", "baz" ] }
    Output: "N$f_$_foo__baz"
*/
function toFuncIdentifier(components)
{
    function escape(s) {
        return s.replaceAll(/([$_])/g, "$$$1");
    }

    let { base, labels } = components;

    let suffix = labels.map(c => ("_" + escape(c))).join("");

    if (labels.length == suffix.length) {
        return null;
    }

    return `${FuncPrefix}${escape(base)}${suffix}`;
}


/*
    fromFuncIdentifier()
    
    Given a mangled identifier, return the basename and argument labels.

    Input: "N$f_$_foo__baz"
    Output: { base: "_foo", labels: [ "", "baz" ] }
*/
function fromFuncIdentifier(identifier)
{
    if (!identifier.startsWith(FuncPrefix)) {
        return null;
    }

    // Split on "_" not preceded by "$"
    let arr = identifier
        .split(/(?<!\$)_/)
        .map(c => c.replaceAll(/\$([$_])/g, "$1"));

    arr.shift();
    
    return { base: arr.shift(), labels: arr };
}


/*
    toFuncString()
  
    Given a basename and argument labels, return the human-readable string.

    Input: { base: "_foo", labels: [ "", "baz" ] }
    Output: "_foo(_:baz:)"
*/
function toFuncString(components)
{
    let args = components.labels
        .map(label => (label ? label : "_") + ":")
        .join("");
    
    return `${components.base}(${args})`;
}


/*
    fromFuncString()
  
    Given a human-readable string of a func, return the basename and argument labels.

    Input: "_foo(_:baz:)"
    Output: { base: "_foo", labels: [ "", "baz" ] }
*/
function fromFuncString(string)
{
    let m = string.match(/(.*?)\((.*?)\)/);
    if (!m) return null;
    
    let base = m[1].trim();
    let labels = m[2].split(":").map(l => {
        l = l.trim();
        return (l == "_" ? "" : l);
    });
    labels.pop();
    
    return { base, labels };
}


function symbolicate(string, squeezerOrSqueezed)
{
    let squeezer;
    let squeezed;

    if (typeof squeezerOrSqueezed?.unsqueeze == "function") {
        squeezer = squeezerOrSqueezed;
    } else {
        squeezed = squeezerOrSqueezed;
    }

    return string.replaceAll(/N\$[A-Za-z0-9$_]+/g, match => {
        if (squeezer) {
            match = squeezer.unsqueeze(match) ?? match;
        } else if (squeezed) {
            match = squeezerOrSqueezed[match] ?? match;
        }

        if (match.startsWith(FuncPrefix)) {
            let components = fromFuncIdentifier(match);
            if (components) {
                return toFuncString(components);
            }

        } else if (match.match(/^N\$[A-Za-z]_/)) {
            return match.substring(4);

        } else {
            return match;
        }
    });
}


export const SymbolUtils = {
    RootVariable,

    getImportExpression,
    getImportIdentifier,
    
    getDebugIdentifier,

    getTypePlaceholder,

    toFuncIdentifier,
    fromFuncIdentifier,

    toFuncString,
    fromFuncString,

    symbolicate
};

