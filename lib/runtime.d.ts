/*
    runtime.d.ts, TypeScript declaration file for runtime.js
    Public Domain.
*/

declare function dispatchInit(instance: any, symbol: symbol, initMethod: any, ...args: any);

declare function N$F_Maybe<T>(x: T): T | undefined;

interface N$R_Runtime {
    g : N$G_Globals;

    i: (instance: any, symbol: symbol, initMethod: any, ...args: any) => void;

    readonly m: unique symbol;
    readonly n: unique symbol;
    readonly p: unique symbol;
    readonly o: unique symbol;
}

declare var N$$_: N$R_Runtime;
