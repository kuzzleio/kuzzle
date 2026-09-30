import type { JSONObject } from "kuzzle-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadConfig } from "../../lib/config";
import defaultConfig from "../../lib/config/default.config";
import { InternalError as KuzzleInternalError } from "../../lib/kerror/errors/internalError";
import packageJson from "../../package.json";

/**
 * `rc` is the one substitution this spec needs: it reads `.kuzzlerc`, the
 * environment and the command line, none of which a unit test may depend on.
 *
 * The Mocha spec re-required `lib/config` after registering the stub, because
 * `mock-require` only affects a *later* `require`. `vi.mock` is hoisted above
 * the imports, so the subject is imported normally and the re-require goes —
 * and with it the `afterEach` that re-required it a second time to undo the
 * first.
 */
const rc = vi.hoisted(() => ({
  load: vi.fn((_name: string, defaults: JSONObject) => defaults),
}));

vi.mock("rc", () => ({
  default: (name: string, defaults: JSONObject) => rc.load(name, defaults),
}));

/** Deep-merges `overrides` into a value, arrays replaced rather than concatenated. */
function merge(target: JSONObject, overrides: JSONObject): JSONObject {
  for (const [key, value] of Object.entries(overrides)) {
    const current = target[key];

    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      current !== null &&
      typeof current === "object" &&
      !Array.isArray(current)
    ) {
      merge(current as JSONObject, value as JSONObject);
    } else {
      target[key] = value;
    }
  }

  return target;
}

/**
 * Loads the configuration as if `.kuzzlerc` carried `overrides`.
 *
 * ⚠️ The defaults are cloned per call because `loadConfig` **mutates what
 * `rc` hands it** — it splits `accessControlAllowOrigin`, replaces
 * `maxFormFileSize` with its parsed value, and assigns `internal`. The Mocha
 * stub answered `Object.assign({}, defaults, overrides)`, a *shallow* copy of
 * the imported module, so every one of those writes landed in the real
 * `default.config.ts` object and stayed there for the rest of the run. It is
 * why one of its tests asserts on the input object rather than on the
 * result — by then the two were the same object.
 *
 * `deep: false` reproduces the Mocha stub's shallow merge, which is how a
 * whole section is replaced — `{ limits: true }` is the section, not one of
 * its keys.
 */
function load(overrides: JSONObject = {}, { deep = true } = {}) {
  rc.load.mockImplementation((_name, defaults) =>
    deep
      ? merge(structuredClone(defaults) as JSONObject, overrides)
      : { ...(structuredClone(defaults) as JSONObject), ...overrides },
  );

  return loadConfig() as unknown as JSONObject;
}

/** The same, for the cases asserting on the rejection. */
const loading =
  (overrides: JSONObject = {}, options?: { deep?: boolean }) =>
  () =>
    load(overrides, options);

describe("#config", () => {
  beforeEach(() => {
    rc.load.mockReset();
  });

  describe("#loadConfig", () => {
    it('asks "rc" for the packaged defaults', () => {
      load();

      expect(rc.load).toHaveBeenCalledTimes(1);
      expect(rc.load.mock.calls[0][0]).toBe("kuzzle");
      expect(rc.load.mock.calls[0][1]).toEqual(defaultConfig);
    });

    it("reports an unreadable configuration file as a Kuzzle error", () => {
      rc.load.mockImplementation(() => {
        throw new Error("foo");
      });

      expect(() => loadConfig()).toThrow(KuzzleInternalError);
      expect(() => loadConfig()).toThrow(
        expect.objectContaining({
          id: "core.configuration.cannot_parse",
          message: "Unable to read kuzzlerc configuration file: foo",
        }),
      );
    });

    it("injects the package's version", () => {
      expect(load().version).toBe(packageJson.version);
    });

    /*
     * `loadConfig()` declares `IKuzzleConfiguration`, the TOTAL shape — not
     * the partial one a user writes. Every config reader in `lib/` is
     * type-checked against that claim, so nothing else would notice if a
     * section stopped being produced: the types would keep saying it is
     * there. See ADR-0001, TD-53 (#2756).
     */
    it("produces every section the merged configuration type declares", () => {
      const result = load();

      const declared = [
        "application",
        "cluster",
        "controllers",
        "dump",
        "http",
        "internal",
        "limits",
        "plugins",
        "realtime",
        "repositories",
        "security",
        "server",
        "services",
        "stats",
        "validation",
        "vault",
        "version",
      ];

      /*
       * Named rather than asserted one by one: the failure that matters is
       * "which section stopped being produced", not "the first one".
       */
      expect(
        declared.filter((section) => result[section] === undefined),
      ).toEqual([]);
    });

    it("still carries the deprecated security.jwt section", () => {
      /*
       * Declared non-optional on the merged shape because `authToken`'s
       * readers fall back to it (`authToken.algorithm ?? jwt.algorithm`) with
       * no guard.
       */
      const jwt = (load().security as JSONObject).jwt as JSONObject;

      expect(jwt).toBeTypeOf("object");
      expect(jwt.algorithm).toBeTypeOf("string");
    });

    it("leaves the imports collection's shard settings to the storage engine", () => {
      /*
       * The Mocha test called `loadConfig()` and then asserted on
       * `defaultConfig.default.services…` — the packaged module, not the
       * result. Whatever `loadConfig` did to those settings, the assertion
       * could not see it. The port reads the loaded configuration.
       */
      const services = load().services as JSONObject;
      const storageEngine = services.storageEngine as JSONObject;
      const internalIndex = storageEngine.internalIndex as JSONObject;
      const collections = internalIndex.collections as JSONObject;
      const imports = collections.imports as JSONObject;
      const settings = imports.settings as JSONObject;

      expect(settings.number_of_shards).toBeUndefined();
      expect(settings.number_of_replicas).toBeUndefined();
    });
  });

  describe("#unstringify", () => {
    /*
     * Everything a `.kuzzlerc` or an environment variable carries arrives as
     * a string, so the loader re-types it. Anything whose key ends in
     * "version" is left alone.
     */
    it("keeps a version-suffixed key as a string", () => {
      const result = load({ anotherVersion: "false", someVersion: "1" });

      expect(result.version).toBe(packageJson.version);
      expect(result.someVersion).toBe("1");
      expect(result.anotherVersion).toBe("false");
    });

    it("converts booleans", () => {
      const result = load({ bar: "false", foo: "true" });

      expect(result.foo).toBe(true);
      expect(result.bar).toBe(false);
    });

    it("converts numbers", () => {
      const result = load({ bar: "0.25", foo: "42" });

      expect(result.foo).toBe(42);
      expect(result.bar).toBe(0.25);
    });

    it("parses a *json: prefixed string", () => {
      const result = load({
        bar: '*json:["foo", null, 123, 123.45, true]',
        baz: '*json:{"this": { "goes": ["to", 11] } }',
      });

      expect(result.bar).toEqual(["foo", null, 123, 123.45, true]);
      expect(result.baz).toEqual({ this: { goes: ["to", 11] } });
    });

    it("names the key whose *json: payload does not parse", () => {
      expect(
        loading({
          foo: '*json:{ ahah: "I am using teh internet", nothing = to see here}',
        }),
      ).toThrow(
        expect.objectContaining({
          id: "core.configuration.cannot_parse",
          message: expect.stringContaining(
            'the key "foo" does not contain a valid stringified JSON',
          ),
        }),
      );
    });

    it("descends into nested sections", () => {
      const result = load({
        foo: "42",
        nested: { bar: "true", sub: { baz: "false" } },
      });

      expect(result.foo).toBe(42);
      expect((result.nested as JSONObject).bar).toBe(true);
      expect(((result.nested as JSONObject).sub as JSONObject).baz).toBe(false);
    });
  });

  describe("#checkLimitsConfig", () => {
    /** Every limit the checker walks; `requestsRate` is not one of them. */
    const limits = Object.keys(defaultConfig.limits).filter(
      (limit) => limit !== "requestsRate",
    );

    /** The three limits that are allowed to be 0. */
    const canBeZero = [
      "subscriptionMinterms",
      "subscriptionRooms",
      "subscriptionDocumentTTL",
    ];

    it.each([[true], [["foo", "bar"]]])(
      "refuses a limits section that is not an object: %s",
      (section) => {
        expect(loading({ limits: section }, { deep: false })).toThrow(
          expect.objectContaining({ id: "core.configuration.invalid_type" }),
        );
      },
    );

    /*
     * Not covered by the Mocha spec, which only replaced the whole section:
     * each limit is read through a guard of its own, and a `.kuzzlerc` is
     * free to set one of them to something that is not a number.
     */
    it("refuses a limit that is not a number", () => {
      expect(loading({ limits: { concurrentRequests: null } })).toThrow(
        expect.objectContaining({ id: "core.configuration.invalid_type" }),
      );
    });

    it.each(limits)("refuses a negative %s", (limit) => {
      expect(loading({ limits: { [limit]: -1 } })).toThrow(
        expect.objectContaining({ id: "core.configuration.out_of_range" }),
      );
    });

    it.each(limits)("handles a zero %s", (limit) => {
      if (canBeZero.includes(limit)) {
        expect(
          (load({ limits: { [limit]: 0 } }).limits as JSONObject)[limit],
        ).toBe(0);
      } else {
        expect(loading({ limits: { [limit]: 0 } })).toThrow(
          expect.objectContaining({ id: "core.configuration.out_of_range" }),
        );
      }
    });

    it.each([
      ["above the buffer size", 1234, 456],
      ["equal to the buffer size", 1234, 1234],
    ])(
      "refuses concurrentRequests %s",
      (_case, concurrentRequests, requestsBufferSize) => {
        expect(
          loading({ limits: { concurrentRequests, requestsBufferSize } }),
        ).toThrow(
          expect.objectContaining({ id: "core.configuration.out_of_range" }),
        );
      },
    );

    it.each([
      ["below concurrentRequests", 1],
      ["above the buffer size", 101],
    ])(
      "refuses a warning threshold %s",
      (_case, requestsBufferWarningThreshold) => {
        expect(
          loading({
            limits: {
              concurrentRequests: 50,
              requestsBufferSize: 100,
              requestsBufferWarningThreshold,
            },
          }),
        ).toThrow(
          expect.objectContaining({ id: "core.configuration.out_of_range" }),
        );
      },
    );
  });

  describe("#checkHttpOptions", () => {
    /** Sets one key of `server.protocols.http`. */
    const protocol = (overrides: JSONObject) => ({
      server: { protocols: { http: overrides } },
    });

    it.each([[null], [123], [0], [true]])(
      'refuses an "accessControlAllowOrigin" that is neither array nor string: %s',
      (bad) => {
        expect(loading({ http: { accessControlAllowOrigin: bad } })).toThrow(
          `[http] "accessControlAllowOrigin" parameter: invalid value "${bad}" (array or string expected)`,
        );
      },
    );

    /*
     * Not covered by the Mocha spec: two of the six `http` asserts. This one
     * reads `http`, not `server.protocols.http`, and must print what it read
     * (TD-79: it used to print the other section, so always "undefined").
     */
    it.each([[null], ["foo"], [123], [[]]])(
      'refuses an "accessControlAllowOriginUseRegExp" that is not a boolean: %s',
      (bad) => {
        expect(
          loading({ http: { accessControlAllowOriginUseRegExp: bad } }),
        ).toThrow(
          `[http] "accessControlAllowOriginUseRegExp" parameter: invalid value "${bad}" (boolean expected)`,
        );
      },
    );

    it.each([[null], ["foo"], [123], [[]]])(
      'refuses a "cookieAuthentication" that is not a boolean: %s',
      (bad) => {
        expect(loading({ http: { cookieAuthentication: bad } })).toThrow(
          /"cookieAuthentication" parameter/,
        );
      },
    );

    it.each([[null], ["foo"], [123], [0], [[]], [{}]])(
      'refuses an "enabled" that is not a boolean: %s',
      (bad) => {
        expect(loading(protocol({ enabled: bad }))).toThrow(
          `[http] "enabled" parameter: invalid value "${bad}" (boolean expected)`,
        );
      },
    );

    it.each([[null], ["foo"], [123], [0], [[]], [{}]])(
      'refuses an "allowCompression" that is not a boolean: %s',
      (bad) => {
        expect(loading(protocol({ allowCompression: bad }))).toThrow(
          `[http] "allowCompression" parameter: invalid value "${bad}" (boolean expected)`,
        );
      },
    );

    it.each([[null], ["foo"], [0], [true], [[]], [{}]])(
      'refuses a "maxEncodingLayers" below 1: %s',
      (bad) => {
        expect(loading(protocol({ maxEncodingLayers: bad }))).toThrow(
          `[http] "maxEncodingLayers" parameter: invalid value "${bad}" (integer >= 1 expected)`,
        );
      },
    );

    it.each([[null], [-1], [true], [[]], [{}], ["foobar"]])(
      'refuses a "maxFormFileSize" it cannot parse: %s',
      (bad) => {
        expect(loading(protocol({ maxFormFileSize: bad }))).toThrow(
          `[http] "maxFormFileSize" parameter: cannot parse "${bad}"`,
        );
      },
    );

    /*
     * Not covered by the Mocha spec: the checker does not only validate
     * `maxFormFileSize`, it *replaces* it with the parsed byte count, and
     * every reader downstream expects the number rather than the "1mb" a
     * `.kuzzlerc` writes.
     */
    it('parses "maxFormFileSize" into a byte count', () => {
      const result = load(protocol({ maxFormFileSize: "1mb" }));
      const server = result.server as JSONObject;
      const protocols = server.protocols as JSONObject;
      const http = protocols.http as JSONObject;

      expect(http.maxFormFileSize).toBe(1024 * 1024);
    });

    it.each([[null], [123], [true], [{}], ["foobar"]])(
      'refuses an "additionalContentTypes" that is not an array of strings: %s',
      (bad) => {
        expect(loading(protocol({ additionalContentTypes: bad }))).toThrow(
          `[http] "additionalContentTypes" parameter: invalid value "${bad}" (array of strings expected)`,
        );
      },
    );
  });

  describe("#checkWebSocketOptions", () => {
    const protocol = (overrides: JSONObject) => ({
      server: { protocols: { websocket: overrides } },
    });

    it.each([[null], ["foo"], [123], [0], [[]], [{}]])(
      'refuses an "enabled" that is not a boolean: %s',
      (bad) => {
        expect(loading(protocol({ enabled: bad }))).toThrow(
          `[websocket] "enabled" parameter: invalid value "${bad}" (boolean expected)`,
        );
      },
    );

    it.each([[null], ["foo"], [-1], [[]], [{}], [true]])(
      'refuses an "idleTimeout" that is not a positive integer: %s',
      (bad) => {
        expect(loading(protocol({ idleTimeout: bad }))).toThrow(
          `[websocket] "idleTimeout" parameter: invalid value "${bad}" (integer >= 0 expected)`,
        );
      },
    );

    /*
     * Accepted here on purpose (TD-79): the 1000 ms floor belongs to the
     * protocol, which replaces a lower value with its default and warns —
     * refusing it at load time would stop servers that boot today.
     */
    it("accepts an idleTimeout below 1000, which the protocol defaults", () => {
      const result = load(protocol({ idleTimeout: 500 }));
      const server = result.server as JSONObject;
      const protocols = server.protocols as JSONObject;
      const websocket = protocols.websocket as JSONObject;

      expect(websocket.idleTimeout).toBe(500);
    });

    it.each([[null], ["foo"], [123], [0], [[]], [{}]])(
      'refuses a "compression" that is not a boolean: %s',
      (bad) => {
        expect(loading(protocol({ compression: bad }))).toThrow(
          `[websocket] "compression" parameter: invalid value "${bad}" (boolean expected)`,
        );
      },
    );

    it.each([[null], ["foo"], [-1], [[]], [{}], [true]])(
      'refuses a "rateLimit" that is not a positive integer: %s',
      (bad) => {
        expect(loading(protocol({ rateLimit: bad }))).toThrow(
          `[websocket] "rateLimit" parameter: invalid value "${bad}" (integer >= 0 expected)`,
        );
      },
    );

    it.each([[null], ["foo"], [123], [0], [[]], [{}]])(
      'refuses a "sendPingsAutomatically" that is not a boolean: %s',
      (bad) => {
        expect(loading(protocol({ sendPingsAutomatically: bad }))).toThrow(
          `[websocket] "sendPingsAutomatically" parameter: invalid value "${bad}" (boolean expected)`,
        );
      },
    );

    it.each([[null], ["foo"], [123], [0], [[]], [{}]])(
      'refuses a "resetIdleTimeoutOnSend" that is not a boolean: %s',
      (bad) => {
        expect(loading(protocol({ resetIdleTimeoutOnSend: bad }))).toThrow(
          `[websocket] "resetIdleTimeoutOnSend" parameter: invalid value "${bad}" (boolean expected)`,
        );
      },
    );
  });

  /*
   * Not covered by the Mocha spec at all — eleven assertions on the section
   * that decides whether a node can join its cluster, and a `.kuzzlerc` is
   * the only place they are ever set.
   */
  describe("#checkClusterOptions", () => {
    it.each([
      "heartbeat",
      "joinTimeout",
      "minimumNodes",
      "activityDepth",
      "syncTimeout",
    ])("refuses a %s that is not a number greater than 0", (prop) => {
      expect(loading({ cluster: { [prop]: 0 } })).toThrow(
        `[CONFIG] kuzzlerc.cluster.${prop}: value must be a number greater than 0`,
      );
    });

    it("refuses a syncTimeout that is not lower than the join timeout", () => {
      expect(
        loading({ cluster: { joinTimeout: 1000, syncTimeout: 1000 } }),
      ).toThrow(
        "[CONFIG] kuzzlerc.cluster.syncTimeout: value must be lower than kuzzlerc.cluster.joinTimeout",
      );
    });

    it.each(["command", "sync"])(
      "refuses a ports.%s that is not a number greater than 0",
      (port) => {
        expect(loading({ cluster: { ports: { [port]: "nope" } } })).toThrow(
          `[CONFIG] kuzzlerc.cluster.ports.${port}: value must be a number greater than 0`,
        );
      },
    );

    it.each([
      ["messages", -1],
      ["messages", 1.5],
      ["bytes", "16MiB"],
      ["bytes", null],
    ])(
      "refuses a retransmitBuffer.%s that is not an integer >= 0: %s",
      (prop, bad) => {
        expect(
          loading({ cluster: { retransmitBuffer: { [prop]: bad } } }),
        ).toThrow(
          `[CONFIG] kuzzlerc.cluster.retransmitBuffer.${prop}: integer >= 0 expected`,
        );
      },
    );

    it("accepts a retransmitBuffer of 0, which disables retransmission", () => {
      const result = load({
        cluster: { retransmitBuffer: { bytes: 0, messages: 0 } },
      });

      expect((result.cluster as JSONObject).retransmitBuffer).toEqual({
        bytes: 0,
        messages: 0,
      });
    });

    it("refuses an ipv6 that is not a boolean", () => {
      expect(loading({ cluster: { ipv6: "yes" } })).toThrow(
        "[CONFIG] kuzzlerc.cluster.ipv6: boolean expected",
      );
    });

    /*
     * An environment variable cannot carry `null`, so the two spellings that
     * reach the loader instead are normalised here — otherwise the string
     * "null" would be read as an IP selector and rejected.
     */
    it.each([
      ["", "an empty string"],
      ["null", 'the string "null"'],
    ])("normalises %s to no ip selector (%s)", (ip) => {
      expect((load({ cluster: { ip } }).cluster as JSONObject).ip).toBeNull();
    });

    it("refuses an ip selector that is neither public nor private", () => {
      expect(loading({ cluster: { ip: "foobar" } })).toThrow(
        "[CONFIG] kuzzlerc.cluster.ip: invalid value (accepted values: public, private)",
      );
    });

    it("refuses an interface that is not a string", () => {
      expect(loading({ cluster: { interface: 42 } })).toThrow(
        "[CONFIG] kuzzlerc.cluster.interface: value must be either null, or a string",
      );
    });
  });

  describe("#preprocessHttpOptions", () => {
    const originsOf = (result: JSONObject) =>
      (result.http as JSONObject).accessControlAllowOrigin;

    it("splits a comma-separated accessControlAllowOrigin into a list", () => {
      /*
       * The Mocha test asserted on the object it had handed to `rc`, not on
       * the result — which only worked because its stub shallow-copied the
       * packaged defaults, so the subject's in-place rewrite landed on the
       * test's own fixture. The port asserts the loaded configuration.
       */
      expect(
        originsOf(load({ http: { accessControlAllowOrigin: "foo, bar" } })),
      ).toEqual(["foo", "bar"]);
    });

    it("records that every origin is allowed when * is among them", () => {
      const result = load({
        http: { accessControlAllowOrigin: "foo, bar, *" },
      });

      expect(originsOf(result)).toEqual(["foo", "bar", "*"]);
      expect((result.internal as JSONObject).allowAllOrigins).toBe(true);
    });

    it("records that they are not when it is not", () => {
      const result = load({ http: { accessControlAllowOrigin: "foo, bar" } });

      expect((result.internal as JSONObject).allowAllOrigins).toBe(false);
    });

    /* Not covered by the Mocha spec: the regular-expression path. */
    it("compiles every origin to a RegExp when asked to", () => {
      const result = load({
        http: {
          accessControlAllowOrigin: "^https://.*\\.kuzzle\\.io$",
          accessControlAllowOriginUseRegExp: true,
        },
      });

      const origins = originsOf(result) as RegExp[];

      expect(origins).toHaveLength(1);
      expect(origins[0]).toBeInstanceOf(RegExp);
      expect(origins[0].test("https://docs.kuzzle.io")).toBe(true);
      expect(origins[0].test("https://kuzzle.io.example.com")).toBe(false);
    });
  });

  /*
   * Not covered by the Mocha spec: `internal.notifiableProtocols` is what the
   * realtime notifier iterates, so a protocol missing from it is a protocol
   * whose subscribers are never notified.
   */
  describe("#preprocessProtocolsOptions", () => {
    it("lists the enabled protocols that carry realtime notifications", () => {
      const result = load({
        server: {
          protocols: {
            http: { enabled: true, realtimeNotifications: false },
            mqtt: { enabled: false, realtimeNotifications: true },
            websocket: { enabled: true, realtimeNotifications: true },
          },
        },
      });

      expect((result.internal as JSONObject).notifiableProtocols).toEqual([
        "websocket",
      ]);
    });
  });

  describe("#preprocessRedisOptions", () => {
    it("carries the deprecated database option into the redis client options", () => {
      const cache = {
        database: 4,
        node: { host: "foobar", port: 6379 },
      };

      const services = load({
        services: { internalCache: cache, memoryStorage: cache },
      }).services as JSONObject;

      expect(
        ((services.internalCache as JSONObject).options as JSONObject).db,
      ).toBe(4);
      expect(
        ((services.memoryStorage as JSONObject).options as JSONObject).db,
      ).toBe(4);
    });

    /*
     * Not covered by the Mocha spec: the deprecated key is a *fallback*, so
     * an explicit `options.db` has to win — the spread puts `database` first
     * precisely for that.
     */
    it("lets an explicit options.db win over it", () => {
      const services = load({
        services: { internalCache: { database: 4, options: { db: 7 } } },
      }).services as JSONObject;

      expect(
        ((services.internalCache as JSONObject).options as JSONObject).db,
      ).toBe(7);
    });
  });
});
