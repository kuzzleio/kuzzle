import { describe, expect, it, vi } from "vitest";

import memoize from "../../lib/util/memoize";

describe("#util/memoize", () => {
  it("returns a callable wrapper", () => {
    const memoized = memoize<[string], number>(Math.random);

    expect(memoized).toBeTypeOf("function");
    // What makes it a memoized function rather than any function: the cache
    // and the resolver it carries.
    expect(memoized.cache).toBeInstanceOf(Map);
    expect(memoized.resolver).toBeNull();
  });

  it("invokes the underlying function once per distinct argument", () => {
    const underlying = vi.fn(Math.random);
    const memoized = memoize<[string], number>(underlying);

    const foo = memoized("foo");
    const bar = memoized("bar");

    expect(memoized("foo")).toBe(foo);
    expect(memoized("foo")).toBe(foo);
    expect(memoized("bar")).toBe(bar);
    expect(memoized("bar")).toBe(bar);
    expect(memoized("foo")).toBe(foo);
    expect(memoized("bar")).toBe(bar);

    expect(underlying).toHaveBeenCalledTimes(2);
    expect(underlying).toHaveBeenCalledWith("foo");
    expect(underlying).toHaveBeenCalledWith("bar");
  });

  it("keys the cache with the provided resolver", () => {
    const underlying = vi.fn(Math.random);
    const memoized = memoize<[string], number>(underlying, () => "bar");

    const result = memoized("foo");

    expect(memoized("foo")).toBe(result);
    expect(memoized("baz")).toBe(result);
    expect(memoized("qux")).toBe(result);

    // Invoked once: the resolver always returns the same key, so every call
    // after the first is a cache hit whatever its argument.
    expect(underlying).toHaveBeenCalledOnce();
    expect(underlying).toHaveBeenCalledWith("foo");
  });

  it("hands the resolver the argument list", () => {
    const resolver = vi.fn(() => "key");

    memoize<[number, number, number], number>(Math.random, resolver)(1, 2, 3);

    // The resolver takes the arguments as one array, not spread — the Mocha
    // spec's resolver ignored them, so the calling convention went untested.
    expect(resolver).toHaveBeenCalledWith([1, 2, 3]);
  });

  it("caches the promise of an async function, not its value", async () => {
    const underlying = vi.fn(async () => Math.random());
    const memoized = memoize<[string], Promise<number>>(underlying);

    const promise = memoized("foo");

    expect(promise).toBeInstanceOf(Promise);

    const result = await promise;

    await expect(memoized("foo")).resolves.toBe(result);
    await expect(memoized("foo")).resolves.toBe(result);
    await expect(memoized("foo")).resolves.toBe(result);

    expect(underlying).toHaveBeenCalledOnce();
    expect(underlying).toHaveBeenCalledWith("foo");
  });
});
