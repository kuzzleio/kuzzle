import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* A named export, not a namespace: the Mocha spec imported the module object. */
import { deprecateProperties } from "../../lib/util/deprecate";

describe("#util/Deprecate", () => {
  const source = { 1337: "leet", FOO: "baz", foo: "bar", leet: 1337 };

  let logger: { warn: ReturnType<typeof vi.fn> };
  let nodeEnv: string | undefined;
  let deprecated: Record<string, unknown>;

  beforeEach(() => {
    /*
     * The subject takes the logger as an argument — it reads nothing off
     * `global.kuzzle`. The Mocha spec built a KuzzleMock only to reach
     * `kuzzle.log.warn`, which made the spec look like it needed the
     * application to test a `Proxy`.
     */
    nodeEnv = global.NODE_ENV;
    global.NODE_ENV = "development";
    logger = { warn: vi.fn() };

    deprecated = deprecateProperties(
      logger as never,
      { ...source },
      {
        1337: { message: "gig" },
        foo: "FOO",
        leet: null,
      },
    ) as Record<string, unknown>;
  });

  afterEach(() => {
    global.NODE_ENV = nodeEnv;
  });

  describe("#deprecateProperties", () => {
    it("wraps the object in a proxy", () => {
      expect(deprecated.__isProxy).toBe(true);
    });

    it("hands back the object untouched outside development", () => {
      global.NODE_ENV = "production";

      const untouched = deprecateProperties(
        logger as never,
        { ...source },
        { foo: "FOO" },
      ) as Record<string, unknown>;

      expect(untouched.__isProxy).not.toBe(true);
      /*
       * Not asserted by the Mocha spec: the point of returning the object
       * as-is is that reading a deprecated property stays silent.
       */
      expect(untouched.foo).toBe("bar");
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("keeps reading the property through", () => {
      expect(deprecated.foo).toBe("bar");
      expect(deprecated.leet).toBe(1337);
    });

    it("warns with the replacement when one is named", () => {
      expect(deprecated.foo).toBeDefined();

      expect(logger.warn).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenNthCalledWith(1, "DEPRECATION WARNING");
      expect(logger.warn).toHaveBeenNthCalledWith(
        2,
        "Use of 'foo' property is deprecated. Please, use 'FOO' instead.",
      );
    });

    it("warns without a replacement when none is named", () => {
      expect(deprecated.leet).toBeDefined();

      expect(logger.warn).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenNthCalledWith(1, "DEPRECATION WARNING");
      expect(logger.warn).toHaveBeenNthCalledWith(
        2,
        "Use of 'leet' property is deprecated.",
      );
    });

    it("warns with a custom message when one is given", () => {
      expect(deprecated["1337"]).toBeDefined();

      expect(logger.warn).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenNthCalledWith(1, "DEPRECATION WARNING");
      expect(logger.warn).toHaveBeenNthCalledWith(2, "gig");
    });

    /*
     * Not asserted by the Mocha spec, which only ever read deprecated keys:
     * a property that was not deprecated must not warn.
     */
    it("stays silent for a property that is not deprecated", () => {
      expect(deprecated.FOO).toBe("baz");

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
