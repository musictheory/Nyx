/*
    runtime.d.ts, TypeScript declaration file for runtime.js
    Public Domain.
*/

declare function dispatchInit(instance: any, symbol: symbol, initMethod: any, ...args: any);

declare function N$F_Maybe<T>(x: T): T | undefined;

interface N$R_Runtime {
    g : N$G_Globals;

    i: dispatchInit,
    m: symbol,
    n: symbol,
    p: symbol,

    o: symbol
}

declare var N$$_: N$R_Runtime;
