import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import debug from "debug";

// Importing the module installs the `%a` formatter and neutralises formatArgs
// on the shared `debug` singleton. Those mutations are idempotent, so a plain
// static import is enough — what has to be restored between tests is the
// enabled-namespace set and `inspectOpts`, which afterEach does.
import createDebug from "../../lib/util/debug";

describe("#debug", () => {
  let kuzzle: { log: { level: string; debug: ReturnType<typeof vi.fn> } };
  const previousNamespaces = debug.disable();

  beforeEach(() => {
    kuzzle = { log: { level: "info", debug: vi.fn() } };
    (globalThis as { kuzzle?: unknown }).kuzzle = kuzzle;
  });

  afterEach(() => {
    debug.disable();
    debug.enable(previousNamespaces);
    delete debug.inspectOpts.expand;
    vi.restoreAllMocks();
  });

  describe("#createDebug", () => {
    it("returns a namespaced debug instance", () => {
      const instance = createDebug("kuzzle:test");

      expect(typeof instance).toBe("function");
      expect(instance.namespace).toBe("kuzzle:test");
    });

    it("routes output to global.kuzzle.log.debug, tagged with the namespace", () => {
      debug.enable("kuzzle:test");
      const instance = createDebug("kuzzle:test");

      instance("hello");

      expect(kuzzle.log.debug).toHaveBeenCalledTimes(1);
      expect(kuzzle.log.debug.mock.calls[0][0]).toEqual({
        namespace: "kuzzle:test",
      });
    });

    it("logs nothing when the namespace is not enabled", () => {
      debug.enable("kuzzle:other");
      const instance = createDebug("kuzzle:test");

      instance("hello");

      expect(kuzzle.log.debug).not.toHaveBeenCalled();
    });

    it("raises the logger level to debug when it is neither debug nor trace", () => {
      debug.enable("kuzzle:test");
      const instance = createDebug("kuzzle:test");

      instance("hello");

      expect(kuzzle.log.level).toBe("debug");
    });

    it("leaves an already-verbose logger level alone", () => {
      debug.enable("kuzzle:test");
      const instance = createDebug("kuzzle:test");

      for (const level of ["debug", "trace"]) {
        kuzzle.log.level = level;
        instance("hello");
        expect(kuzzle.log.level).toBe(level);
      }
    });
  });

  describe("the %a formatter", () => {
    it("is registered on the shared debug singleton", () => {
      expect(typeof debug.formatters.a).toBe("function");
    });

    it("inspects the value on a single line by default", () => {
      const formatted = debug.formatters.a.call(debug("x"), {
        a: 1,
        b: { c: 2 },
      });

      expect(formatted).not.toContain("\n");
      expect(formatted).toContain("a:");
    });

    it("keeps the multi-line inspect output when inspectOpts.expand is set", () => {
      debug.inspectOpts.expand = true;

      const formatted = debug.formatters.a.call(debug("x"), {
        aLongKeyName: "a".repeat(60),
        anotherLongKey: "b".repeat(60),
      });

      expect(formatted.startsWith("\n")).toBe(true);
      expect(formatted).toContain("\n");
    });
  });
});
