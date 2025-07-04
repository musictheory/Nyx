// Based on 

type AssertPredicate = RegExp | (new() => object) | ((thrown: unknown) => boolean) | object | Error;

interface AssertInterface {
    (value: unknown, message?: string | Error): asserts value;

    fail(message?: string | Error): never;

    ok(value: unknown, message?: string | Error): asserts value;

    equal(actual: unknown, expected: unknown, message?: string | Error): void;
    notEqual(actual: unknown, expected: unknown, message?: string | Error): void;

    deepEqual(actual: unknown, expected: unknown, message?: string | Error): void;
    notDeepEqual(actual: unknown, expected: unknown, message?: string | Error): void;

    strictEqual<T>(actual: unknown, expected: T, message?: string | Error): asserts actual is T;
    notStrictEqual(actual: unknown, expected: unknown, message?: string | Error): void;

    deepStrictEqual<T>(actual: unknown, expected: T, message?: string | Error): asserts actual is T;
    notDeepStrictEqual(actual: unknown, expected: unknown, message?: string | Error): void;

    throws(block: () => unknown, message?: string | Error): void;
    throws(block: () => unknown, error: AssertPredicate, message?: string | Error): void;

    doesNotThrow(block: () => unknown, message?: string | Error): void;
    doesNotThrow(block: () => unknown, error: AssertPredicate, message?: string | Error): void;

    ifError(value: unknown): asserts value is null | undefined;

    rejects(
        block: (() => Promise<unknown>) | Promise<unknown>,
        message?: string | Error
    ): Promise<void>;
    
    rejects(
        block: (() => Promise<unknown>) | Promise<unknown>,
        error: AssertPredicate,
        message?: string | Error,
    ): Promise<void>;

    doesNotReject(
        block: (() => Promise<unknown>) | Promise<unknown>,
        message?: string | Error,
    ): Promise<void>;

    doesNotReject(
        block: (() => Promise<unknown>) | Promise<unknown>,
        error: AssertPredicate,
        message?: string | Error,
    ): Promise<void>;

    match(value: string, regExp: RegExp, message?: string | Error): void;
    doesNotMatch(value: string, regExp: RegExp, message?: string | Error): void;

    partialDeepStrictEqual(actual: unknown, expected: unknown, message?: string | Error): void;
}

declare var assert: AssertInterface;
