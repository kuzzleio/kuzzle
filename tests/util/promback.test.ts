import { describe, expect, it, vi } from "vitest";

import Promback from "../../lib/util/promback";

describe("#Promback", () => {
  describe("promise mode (no callback)", () => {
    it("exposes a deferred and reports isPromise", () => {
      const promback = new Promback<string>();

      expect(promback.isPromise).toBe(true);
      expect(promback.deferred).not.toBeNull();
      // `promise` is an alias of `deferred`, kept for readability at call sites.
      expect(promback.promise).toBe(promback.deferred);
    });

    it("resolves the deferred with the provided value", async () => {
      const promback = new Promback<string>();

      const returned = promback.resolve("done");

      expect(returned).toBe(promback.deferred);
      await expect(promback.deferred).resolves.toBe("done");
    });

    it("resolves with undefined when called with no argument", async () => {
      const promback = new Promback<string>();

      promback.resolve();

      await expect(promback.deferred).resolves.toBeUndefined();
    });

    it("rejects the deferred with the provided error", async () => {
      const promback = new Promback<string>();
      const error = new Error("nope");

      const returned = promback.reject(error);

      expect(returned).toBe(promback.deferred);
      await expect(promback.deferred).rejects.toThrow("nope");
    });

    it("ignores a second settlement, as any promise does", async () => {
      const promback = new Promback<string>();

      promback.resolve("first");
      promback.resolve("second");
      promback.reject(new Error("too late"));

      await expect(promback.deferred).resolves.toBe("first");
    });
  });

  describe("callback mode", () => {
    it("does not create a deferred", () => {
      const promback = new Promback<string>(vi.fn());

      expect(promback.isPromise).toBe(false);
      expect(promback.deferred).toBeNull();
      expect(promback.promise).toBeNull();
    });

    it("calls back node-style on resolve: (null, result)", () => {
      const callback = vi.fn();
      const promback = new Promback<string>(callback);

      const returned = promback.resolve("done");

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(null, "done");
      // Nothing to return in callback mode.
      expect(returned).toBeNull();
    });

    it("calls back with the error alone on reject", () => {
      const callback = vi.fn();
      const promback = new Promback<string>(callback);
      const error = new Error("nope");

      expect(promback.reject(error)).toBeNull();
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(error);
    });

    it("calls the callback again on a second settlement — unlike promise mode", () => {
      const callback = vi.fn();
      const promback = new Promback<string>(callback);

      promback.resolve("first");
      promback.resolve("second");

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenNthCalledWith(2, null, "second");
    });
  });

  describe("an explicit null callback selects promise mode", () => {
    // `pluginContext.execute` relies on this: it forwards a possibly-absent
    // user callback straight to the constructor.
    it("behaves like the no-argument form", async () => {
      const promback = new Promback<string>(null);

      expect(promback.isPromise).toBe(true);
      promback.resolve("done");
      await expect(promback.deferred).resolves.toBe("done");
    });
  });
});
