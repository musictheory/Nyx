/*
    runtimeExtGuards.js, runtime extension for "undefined-guards" feature
    Public Domain.
*/

(function() { "use strict";

const _ = globalThis[Symbol.for("__N$$__")];

const afterInitCheckSymbol = Symbol();


function afterInitCheck(className, props)
{
    let undefinedProps = [ ];

    for (let i = 0; i < props.length; ) {
        let name = props[i++];
        let value = props[i++];
        if (value === undefined) {
            undefinedProps.push(`'${name}'`);
        }
    }

    if (undefinedProps.length) {
        try {
            throw new Error(`'${className}' has undefined props after init: ${undefinedProps}`);
        } catch (e) {
            _.r?.(e); 
        }
    }
}


function getCheck(name, value)
{
    if (value === undefined) {
        try {
            throw new Error(`'${name}' is undefined`);
        } catch (e) {
            _.r?.(e); 
        }
    }
}


function setCheck(name, value)
{
    if (value === undefined) {
        try {
            throw new Error(`Setting '${name}' to undefined.`);
        } catch (e) {
            _.r?.(e); 
        }
    }
}


function reportUndefined(err)
{
    globalThis.console?.log(err);
}



if (!_.g) {
    _.g = afterInitCheckSymbol;

    _.gi = afterInitCheck;
    _.gg = getCheck;
    _.gs = setCheck;

    _.r = reportUndefined;
    
    let oldDispatchInit = _.i;
    _.i = function(instance, symbol, ...rest) {
        oldDispatchInit(instance, symbol, ...rest);

        if (symbol !== _.x) {
            instance[afterInitCheckSymbol]?.();
        }
    };
}


})();
