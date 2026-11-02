import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IdCard } from "../../lib/cluster/idCardHandler";
import {
  assertClusterStorageDriver,
  assertSameStorageDriver,
  localStorageDriver,
  type StorageDriverIdentity,
} from "../../lib/cluster/storageDriverCheck";
import { invalid } from "../helpers/invalid";
import { restoreKuzzle, stubKuzzle } from "../mocks/kuzzle";

/** What the driver loader answers for the configuration under test. */
const selected = vi.hoisted(() => ({
  builtIn: "kuzzle-storage-es-7" as string | null,
  identity: null as string | null,
}));

vi.mock("../../lib/core/storage/storageDriverLoader", () => ({
  selectStorageDriver: () => ({ ...selected }),
}));

/** The ID cards in Redis, one answer per read. */
const cards = vi.hoisted(() => ({ getIdCards: vi.fn() }));

vi.mock("../../lib/cluster/idCardHandler", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/cluster/idCardHandler")>()),
  getIdCards: cards.getIdCards,
}));

const ES7 = "kuzzle-storage-es-7";
const ES8 = "kuzzle-storage-es-8";
const ES9 = "kuzzle-storage-es-9@1.0.0";

const card = (driver: StorageDriverIdentity, id = "knode-other") =>
  new IdCard({ birthdate: 0, id, ip: "10.0.0.2", topology: [], ...driver });

/** A node older than 2.61.0: its card says nothing about its driver. */
const olderNode = () => card({});

describe("#cluster/storageDriverCheck", () => {
  describe("#localStorageDriver", () => {
    it("names a built-in driver by its package, without a version", () => {
      selected.identity = null;
      selected.builtIn = ES8;

      expect(localStorageDriver(invalid({}))).toEqual({
        builtInStorageDriver: ES8,
      });
    });

    it("names an external driver by its package and version", () => {
      selected.identity = ES9;
      selected.builtIn = null;

      expect(localStorageDriver(invalid({}))).toEqual({ storageDriver: ES9 });
    });
  });

  describe("#assertSameStorageDriver", () => {
    it.each<[string, StorageDriverIdentity, IdCard]>([
      [
        "the same built-in driver",
        { builtInStorageDriver: ES7 },
        card({ builtInStorageDriver: ES7 }),
      ],
      [
        "the same external driver",
        { storageDriver: ES9 },
        card({ storageDriver: ES9 }),
      ],
      /* The rolling upgrade from 2.60: no configuration change, and the
       * older nodes do not say which major version they run. */
      [
        "a built-in driver, among nodes older than 2.61.0",
        { builtInStorageDriver: ES8 },
        olderNode(),
      ],
    ])("accepts %s", (_case, local, remote) => {
      expect(() => assertSameStorageDriver(local, [remote])).not.toThrow();
    });

    it.each<[string, StorageDriverIdentity, IdCard, string]>([
      [
        "Elasticsearch 7 and 8 built-in drivers",
        { builtInStorageDriver: ES8 },
        card({ builtInStorageDriver: ES7 }),
        `This node runs the built-in driver ${ES8}, but the cluster node knode-other runs the built-in driver ${ES7}: every cluster node must run the same storage driver.`,
      ],
      [
        "an external driver among nodes older than 2.61.0",
        { storageDriver: ES9 },
        olderNode(),
        `This node runs ${ES9}, but the cluster node knode-other runs a built-in Elasticsearch driver: every cluster node must run the same storage driver.`,
      ],
      [
        "an external driver among built-in nodes",
        { storageDriver: ES9 },
        card({ builtInStorageDriver: ES7 }),
        `This node runs ${ES9}, but the cluster node knode-other runs the built-in driver ${ES7}: every cluster node must run the same storage driver.`,
      ],
      [
        "a built-in driver among external ones",
        { builtInStorageDriver: ES7 },
        card({ storageDriver: ES9 }),
        `This node runs the built-in driver ${ES7}, but the cluster node knode-other runs ${ES9}: every cluster node must run the same storage driver.`,
      ],
      [
        "another version of the same external driver",
        { storageDriver: "kuzzle-storage-es-9@1.1.0" },
        card({ storageDriver: ES9 }),
        `This node runs kuzzle-storage-es-9@1.1.0, but the cluster node knode-other runs ${ES9}: every cluster node must run the same storage driver.`,
      ],
    ])("refuses %s", (_case, local, remote, message) => {
      expect(() => assertSameStorageDriver(local, [remote])).toThrow(
        expect.objectContaining({
          id: "cluster.join.storage_driver_mismatch",
          message,
        }),
      );
    });

    it("names the first node that differs", () => {
      expect(() =>
        assertSameStorageDriver({ builtInStorageDriver: ES7 }, [
          olderNode(),
          card({ builtInStorageDriver: ES7 }, "knode-same"),
          card({ builtInStorageDriver: ES8 }, "knode-es8"),
        ]),
      ).toThrow(/cluster node knode-es8 runs/);
    });
  });

  describe("#assertClusterStorageDriver", () => {
    const heartbeat = 2000;
    const config = invalid<Parameters<typeof assertClusterStorageDriver>[0]>({
      cluster: { heartbeat },
      services: { storageEngine: {} },
    });
    let warn: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      selected.identity = ES9;
      selected.builtIn = null;
      cards.getIdCards.mockReset();
      warn = vi.fn();
      stubKuzzle({ log: { warn } });
    });

    afterEach(() => {
      vi.useRealTimers();
      restoreKuzzle();
    });

    it("reads every card, this node having none yet", async () => {
      cards.getIdCards.mockResolvedValue([card({ storageDriver: ES9 })]);

      await assertClusterStorageDriver(config);

      expect(cards.getIdCards).toHaveBeenCalledExactlyOnceWith(null);
      expect(warn).not.toHaveBeenCalled();
    });

    it("starts the first node of a cluster", async () => {
      cards.getIdCards.mockResolvedValue([]);

      await expect(assertClusterStorageDriver(config)).resolves.toBeUndefined();
    });

    /* A full cluster restart, which a driver change requires, can leave the
     * card of a node killed without cleaning up. */
    it("waits for a mismatching card to expire, and starts once it has", async () => {
      vi.useFakeTimers();
      cards.getIdCards
        .mockResolvedValueOnce([olderNode()])
        .mockResolvedValueOnce([]);

      const check = assertClusterStorageDriver(config);
      await vi.advanceTimersByTimeAsync(heartbeat * 3 - 1);

      expect(cards.getIdCards).toHaveBeenCalledOnce();

      await vi.advanceTimersByTimeAsync(1);
      await expect(check).resolves.toBeUndefined();

      expect(cards.getIdCards).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining(
          `but the cluster node knode-other runs a built-in Elasticsearch driver. Waiting ${heartbeat * 3}ms`,
        ),
      );
    });

    it("refuses this node when the mismatching card is still there", async () => {
      vi.useFakeTimers();
      cards.getIdCards.mockResolvedValue([card({ builtInStorageDriver: ES7 })]);

      const check = assertClusterStorageDriver(config);
      const refused = expect(check).rejects.toMatchObject({
        id: "cluster.join.storage_driver_mismatch",
      });
      await vi.advanceTimersByTimeAsync(heartbeat * 3);
      await refused;
    });
  });
});
