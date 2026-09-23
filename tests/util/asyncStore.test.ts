import { describe, expect, it } from "vitest";

import AsyncStore from "../../lib/util/asyncStore";

/**
 * ⚠️ No substitution at all, where the Mocha spec replaced `async_hooks`
 * with a stub whose `run` **did not call its callback**.
 *
 * That stub is what made the suite describe the wrapper rather than the
 * store: `#set` and `#get` reached into `asyncStore._asyncLocalStorage._store`
 * — a Map the stub invented, kept alive outside any asynchronous context —
 * and `#run` asserted only that a Map and a callback were handed over. None
 * of it could tell whether a value set inside a context is visible to the
 * code running in it, which is the one thing an `AsyncLocalStorage` wrapper
 * is for.
 *
 * `AsyncLocalStorage` is a Node builtin with no I/O; the real one runs here.
 */
describe("#util/AsyncStore", () => {
  it("runs the callback inside a store of its own", () => {
    const store = new AsyncStore();
    let ran = false;

    store.run(() => {
      ran = true;
      expect(store.exists()).toBe(true);
    });

    expect(ran).toBe(true);
  });

  it("answers that no store exists outside a run", () => {
    expect(new AsyncStore().exists()).toBe(false);
  });

  it("carries a value through the asynchronous context", async () => {
    const store = new AsyncStore();
    const seen: unknown[] = [];

    await new Promise<void>((resolve) => {
      store.run(() => {
        store.set("REQUEST", { id: "azerty12345" });

        setTimeout(() => {
          /* A different tick, still the same store. */
          seen.push(store.get("REQUEST"));
          resolve();
        }, 0);
      });
    });

    expect(seen).toEqual([{ id: "azerty12345" }]);
  });

  it("answers whether a key is set", () => {
    const store = new AsyncStore();

    store.run(() => {
      store.set("REQUEST", { id: "azerty12345" });

      expect(store.has("REQUEST")).toBe(true);
      expect(store.has("TSEUQER")).toBe(false);
    });
  });

  it("gives each run its own store", () => {
    const store = new AsyncStore();

    store.run(() => {
      store.set("REQUEST", "first");
    });

    store.run(() => {
      expect(store.has("REQUEST")).toBe(false);
    });
  });

  /*
   * Not covered by the Mocha spec — its stub always answered a Map, so the
   * assertion could never be reached. Reading the store outside a run is a
   * programming error, and it says so rather than answering `undefined`.
   */
  it.each(["get", "set", "has"] as const)(
    "refuses to %s outside a run",
    (method) => {
      const store = new AsyncStore();

      expect(() =>
        (store[method] as (...args: unknown[]) => unknown)("REQUEST", "value"),
      ).toThrow("Associated AsyncStore is not set");
    },
  );
});
