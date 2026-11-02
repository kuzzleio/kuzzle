import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { storeScopeEnum } from "../../../lib/core/storage/storeScopeEnum";

// `vi.mock` factories are hoisted above the module body, so everything they
// close over has to come from `vi.hoisted`.
const { instances, ClientAdapterMock } = vi.hoisted(() => {
  const created: unknown[] = [];

  return {
    instances: created,
    ClientAdapterMock: class {
      public cache = { listIndexes: vi.fn<() => string[]>(() => []) };
      public init = vi.fn(async () => undefined);
      /** No `close` hook unless a case gives it one */
      public driver: { close?: () => Promise<void> } = {};

      constructor(public scope: string) {
        created.push(this);
      }
    },
  };
});

type ClientAdapterMock = InstanceType<typeof ClientAdapterMock>;

// clientAdapter ships `export =`, hence `default`.
vi.mock("../../../lib/core/storage/clientAdapter", () => ({
  default: ClientAdapterMock,
}));

/** What the driver loader answers: a built-in driver unless a case says
 * otherwise before building the engine. */
const selected = vi.hoisted(() => ({
  description: "the built-in Elasticsearch 7 driver",
  identity: null as string | null,
  location: null as string | null,
}));

vi.mock("../../../lib/core/storage/storageDriverLoader", () => ({
  selectStorageDriver: () => selected,
}));

import StorageEngine from "../../../lib/core/storage/storageEngine";

describe("#core/storage/StorageEngine", () => {
  let logger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let engine: StorageEngine;

  beforeEach(() => {
    instances.length = 0;
    logger = { info: vi.fn(), warn: vi.fn() };
    (globalThis as { kuzzle?: unknown }).kuzzle = {
      config: { services: { storageEngine: { majorVersion: 7 } } },
      log: { child: vi.fn(() => logger) },
    };

    engine = new StorageEngine();
  });

  /** The mock stands in for the real ClientAdapter, so the types differ. */
  const publicAdapter = () => engine.public as unknown as ClientAdapterMock;
  const privateAdapter = () => engine.private as unknown as ClientAdapterMock;

  describe("#constructor", () => {
    it("instantiates one client adapter per storage scope", () => {
      expect(engine.public).toBeInstanceOf(ClientAdapterMock);
      expect(engine.public.scope).toBe(storeScopeEnum.PUBLIC);

      expect(engine.private).toBeInstanceOf(ClientAdapterMock);
      expect(engine.private.scope).toBe(storeScopeEnum.PRIVATE);

      expect(instances).toHaveLength(2);
    });

    it("logs the configured Elasticsearch major version", () => {
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("major version : 7"),
      );
    });

    it("logs the external storage driver it runs on", () => {
      selected.description = selected.identity = "kuzzle-storage-es-9@1.0.0";
      selected.location = "/app/node_modules/kuzzle-storage-es-9";
      logger.info.mockClear();

      try {
        engine = new StorageEngine();
      } finally {
        selected.description = "the built-in Elasticsearch 7 driver";
        selected.identity = selected.location = null;
      }

      expect(logger.info).toHaveBeenCalledExactlyOnceWith(
        "[ℹ] Storage driver: kuzzle-storage-es-9@1.0.0 (/app/node_modules/kuzzle-storage-es-9)",
      );
    });

    it("warns about the settings the configuration ignores", () => {
      expect(logger.warn).not.toHaveBeenCalled();

      (
        globalThis as { kuzzle: { config: { internal?: unknown } } }
      ).kuzzle.config.internal = {
        ignoredSettings: ["services.storageEngine.majorVersion"],
      };
      engine = new StorageEngine();

      expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
        "[⚠] services.storageEngine.majorVersion is ignored because services.storageEngine.driver is set: remove majorVersion.",
      );
    });
  });

  describe("#init", () => {
    it("initialises both adapters and reports success", async () => {
      await engine.init();

      expect(publicAdapter().init).toHaveBeenCalledOnce();
      expect(privateAdapter().init).toHaveBeenCalledOnce();
      expect(logger.info).toHaveBeenCalledWith("[✔] Storage initialized");
    });

    it("rejects when a public index and a private one share a name", async () => {
      publicAdapter().cache.listIndexes.mockReturnValue([
        "foo",
        "bar",
        "ohnoes",
      ]);
      privateAdapter().cache.listIndexes.mockReturnValue([
        "baz",
        "ohnoes",
        "qux",
      ]);

      await expect(engine.init()).rejects.toMatchObject({
        id: "services.storage.index_already_exists",
      });

      // Both adapters are still initialised — the check runs after.
      expect(publicAdapter().init).toHaveBeenCalledOnce();
      expect(privateAdapter().init).toHaveBeenCalledOnce();
      expect(logger.info).not.toHaveBeenCalledWith("[✔] Storage initialized");
    });

    it("does not reject when the index lists are disjoint", async () => {
      publicAdapter().cache.listIndexes.mockReturnValue(["foo"]);
      privateAdapter().cache.listIndexes.mockReturnValue(["bar"]);

      await expect(engine.init()).resolves.toBeUndefined();
    });
  });

  /* #3141: the drivers release their connections on shutdown. */
  describe("#close", () => {
    it("calls each scope's close hook once, however many times it is called", async () => {
      const closePublic = vi.fn(async () => undefined);
      const closePrivate = vi.fn(async () => undefined);
      publicAdapter().driver.close = closePublic;
      privateAdapter().driver.close = closePrivate;

      await Promise.all([engine.close(), engine.close()]);
      await engine.close();

      expect(closePublic).toHaveBeenCalledOnce();
      expect(closePrivate).toHaveBeenCalledOnce();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("skips a driver without a close hook", async () => {
      const closePrivate = vi.fn(async () => undefined);
      privateAdapter().driver.close = closePrivate;

      await expect(engine.close()).resolves.toBeUndefined();

      expect(closePrivate).toHaveBeenCalledOnce();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("logs a hook that fails, and closes the other scope anyway", async () => {
      const closePrivate = vi.fn(async () => undefined);
      publicAdapter().driver.close = vi.fn(async () => {
        throw new Error("pool already ended");
      });
      privateAdapter().driver.close = closePrivate;

      await expect(engine.close()).resolves.toBeUndefined();

      expect(closePrivate).toHaveBeenCalledOnce();
      expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
        "[⚠] Unable to close the public storage driver: pool already ended",
      );
    });

    it("logs a hook that throws synchronously, or rejects with a non-error", async () => {
      publicAdapter().driver.close = vi.fn(() => {
        throw new Error("not a promise");
      });
      privateAdapter().driver.close = vi.fn(() => Promise.reject("nope"));

      await expect(engine.close()).resolves.toBeUndefined();

      expect(logger.warn).toHaveBeenCalledWith(
        "[⚠] Unable to close the public storage driver: not a promise",
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "[⚠] Unable to close the private storage driver: 'nope'",
      );
    });

    describe("when a hook never settles", () => {
      beforeEach(() => {
        vi.useFakeTimers();
        publicAdapter().driver.close = vi.fn(
          () => new Promise<void>(() => undefined),
        );
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it("gives up after the timeout, and logs it", async () => {
        let closed = false;

        void engine.close(1000).then(() => {
          closed = true;
        });

        await vi.advanceTimersByTimeAsync(999);
        expect(closed).toBe(false);

        await vi.advanceTimersByTimeAsync(1);
        expect(closed).toBe(true);
        expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
          "[⚠] Unable to close the public storage driver: not closed after 1000ms",
        );
      });

      it("waits 5s by default", async () => {
        let closed = false;

        void engine.close().then(() => {
          closed = true;
        });

        await vi.advanceTimersByTimeAsync(4999);
        expect(closed).toBe(false);

        await vi.advanceTimersByTimeAsync(1);
        expect(closed).toBe(true);
      });
    });

    it("leaves no timer behind once the hooks settle", async () => {
      vi.useFakeTimers();

      try {
        publicAdapter().driver.close = vi.fn(async () => undefined);

        await engine.close();

        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
