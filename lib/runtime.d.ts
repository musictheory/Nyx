/*
    runtime.d.ts, TypeScript declaration file for Nyx runtime
    Public Domain.
*/

declare function dispatchInit(instance: any, symbol: symbol, initMethod: any, ...args: any);

declare function N$F_Maybe<T>(x: T): T | undefined;

interface N$R_Runtime {
    i: (instance: any, symbol: symbol, initMethod: any, ...args: any) => void;

    readonly m: unique symbol;
    readonly n: unique symbol;
    readonly p: unique symbol;
    readonly o: unique symbol;
    
    r: ((error: Error) => void) | null;

    // Defined in runtimeExtGuards.js
    readonly g: unique symbol;
    gi: (name: string, args: (any|undefined)[]) => void;
    gg: (name: string, value: any|undefined) => void;
    gs: (name: string, value: any|undefined) => void;
}

declare var N$$_: N$R_Runtime;
