import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cacheDbEnum } from "../../../lib/core/cache/cacheDbEnum";
import PluginRepository from "../../../lib/core/plugin/pluginRepository";
import { Store } from "../../../lib/core/shared/store";
import { storeScopeEnum } from "../../../lib/core/storage/storeScopeEnum";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

describe("#core/plugin/PluginRepository", () => {
  const collection = "someCollection";
  const document = { _id: "someId", some: { defined: "object" } };

  class SomeConstructor {}

  let repository: PluginRepository;
  let store: Store;
  let ask: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    /*
     * `Store` binds the 23 `core:storage:` events to `global.kuzzle.ask` in
     * its constructor and takes a child logger. That is the whole dependency:
     * every method below is one of those events with its arguments filled in.
     */
    ask = vi.fn(async () => undefined);
    stubKuzzle({
      ask,
      /* `ObjectRepository`'s constructor reads the shared cache TTL. */
      config: { repositories: { common: { cacheTTL: 1440000 } } },
    });

    store = new Store("pluginName", storeScopeEnum.PRIVATE);
    repository = new PluginRepository(store, collection);
    repository.init({ ObjectConstructor: SomeConstructor });
  });

  afterEach(() => {
    restoreKuzzle();
  });

  /** The arguments of the first call made for one storage event. */
  const argsFor = (event: string) =>
    ask.mock.calls.find(([name]) => name === event);

  describe("#constructor", () => {
    it("takes its index from the store and caches nothing", () => {
      /*
       * `index`, `collection`, `ObjectConstructor`, `store` and `cacheDb` are
       * `protected` on `ObjectRepository`, and the Mocha spec read all five
       * (TS2445 x 5). They are what the constructor is *for*, so the spec
       * names the access once instead of dropping the assertions.
       */
      const fields = repository as unknown as {
        ObjectConstructor: unknown;
        cacheDb: unknown;
        collection: string;
        index: string;
        store: unknown;
      };

      expect(fields.index).toBe("pluginName");
      expect(fields.collection).toBe(collection);
      expect(fields.ObjectConstructor).toBe(SomeConstructor);
      expect(fields.store).toBe(store);
      expect(fields.cacheDb).toBe(cacheDbEnum.NONE);
    });
  });

  describe("#serializeToDatabase", () => {
    it("drops the _id, without touching the argument", () => {
      expect(repository.serializeToDatabase(document)).toEqual({
        some: { defined: "object" },
      });
      /*
       * Not asserted by the Mocha spec, which compared against a copy it made
       * itself: the subject must copy too, or every caller loses its `_id`.
       */
      expect(document._id).toBe("someId");
    });
  });

  describe("#create", () => {
    it("creates the document under its own id", async () => {
      await repository.create(document);

      expect(argsFor("core:storage:private:document:create")).toEqual([
        "core:storage:private:document:create",
        "pluginName",
        collection,
        { some: { defined: "object" } },
        expect.objectContaining({ id: "someId" }),
      ]);
    });
  });

  describe("#createOrReplace", () => {
    it("passes the id as an argument, not in the body", async () => {
      await repository.createOrReplace(document);

      expect(argsFor("core:storage:private:document:createOrReplace")).toEqual([
        "core:storage:private:document:createOrReplace",
        "pluginName",
        collection,
        "someId",
        { some: { defined: "object" } },
        expect.anything(),
      ]);
    });
  });

  describe("#replace", () => {
    it("passes the id as an argument, not in the body", async () => {
      await repository.replace(document);

      expect(argsFor("core:storage:private:document:replace")).toEqual([
        "core:storage:private:document:replace",
        "pluginName",
        collection,
        "someId",
        { some: { defined: "object" } },
        expect.anything(),
      ]);
    });
  });

  describe("#update", () => {
    it("passes the id as an argument, not in the body", async () => {
      await repository.update(document);

      expect(argsFor("core:storage:private:document:update")).toEqual([
        "core:storage:private:document:update",
        "pluginName",
        collection,
        "someId",
        { some: { defined: "object" } },
        expect.anything(),
      ]);
    });
  });

  describe("#delete", () => {
    it("forwards its options to the storage engine", async () => {
      await repository.delete("someId", { refresh: "wait_for" });

      expect(argsFor("core:storage:private:document:delete")).toEqual([
        "core:storage:private:document:delete",
        "pluginName",
        collection,
        "someId",
        { refresh: "wait_for" },
      ]);
    });
  });
});
