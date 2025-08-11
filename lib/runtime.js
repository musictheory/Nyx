/*
    runtime.js, runtime for the Nyx language
    Public Domain.
*/

(function() { "use strict";

const noInitSymbol    = Symbol();
const namedInitSymbol = Symbol();
const postInitSymbol  = Symbol();
const observerSymbol  = Symbol();

function dispatchInit(instance, symbol, initMethod, ...args)
{
    if (symbol === noInitSymbol) {
        return;
    } else if (symbol === namedInitSymbol) {
        instance[initMethod](...args);
    } else {
        instance.init?.(symbol, initMethod, ...args);
    }
    
    instance[postInitSymbol]?.();
}

const _ = globalThis[Symbol.for("__N$$__")] = {
    $: { },
    f: { },

    i: dispatchInit,
    x: noInitSymbol,
    n: namedInitSymbol,
    p: postInitSymbol,
    
    o: observerSymbol,
    
    r: null
};

})();
