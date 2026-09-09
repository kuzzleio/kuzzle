import { beforeEach, describe, expect, it, vi } from "vitest";

import { storeScopeEnum } from "../../../lib/core/storage/storeScopeEnum";

// `vi.mock` factories are hoisted above the module body, so everything they
// close over has to come from `vi.hoisted`.
const { instances, ClientAdapterMock } = vi.hoisted(() => {
  const instances: unknown[] = [];

  return {
    instances,
    ClientAdapterMock: class {
      public cache = { listIndexes: vi.fn<() => string[]>(() => []) };
      public init = vi.fn(async () => undefined);

      constructor(public scope: string) {
        instances.push(this);
      }
    },
  };
});

type ClientAdapterMock = InstanceType<typeof ClientAdapterMock>;

// clientAdapter ships `export =`, hence `default`.
vi.mock("../../../lib/core/storage/clientAdapter", () => ({
  default: ClientAdapterMock,
}));

import StorageEngine from "../../../lib/core/storage/storageEngine";

describe("#core/storage/StorageEngine", () => {
  let logger: { info: ReturnType<typeof vi.fn> };
  let engine: StorageEngine;

  beforeEach(() => {
    instances.length = 0;
    logger = { info: vi.fn() };
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
});
