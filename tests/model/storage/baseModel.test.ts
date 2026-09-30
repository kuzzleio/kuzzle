import type { JSONObject } from "kuzzle-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BaseModel from "../../../lib/model/storage/baseModel";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

/** A model with two fields, as a plugin or a core collection declares one. */
class Model extends BaseModel {
  declare location: string;
  declare name: string;

  static get collection() {
    return "models";
  }

  static get fields() {
    return ["name", "location"];
  }
}

BaseModel.register(Model);

describe("#model/storage/BaseModel", () => {
  let internalIndex: {
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    deleteByQuery: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    index: string;
    mExecute: ReturnType<typeof vi.fn>;
    refreshCollection: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    /*
     * ⚠️ The subject's only collaborator is `global.kuzzle.internalIndex` —
     * every persistence method calls one of its nine methods directly.
     *
     * The Mocha spec asserted on `kuzzle.ask("core:storage:private:document:…")`
     * instead: those events belong to `InternalIndexHandler`, **one layer
     * below the subject**, and KuzzleMock supplied a real one, so the asks
     * were reachable. That is the same mis-aimed assertion L2b found in
     * `ObjectRepository`, L2d in `collectionController` and L2e in
     * `securityController` — the seventh spec, in the fifth slice, aiming one
     * layer past its subject for the same reason.
     *
     * It also means the Mocha fixture's other half — `mockrequire`-ing
     * `clientAdapter` and re-requiring `storageEngine` to build one — was
     * arrangement wired to nothing: this spec never touches a storage engine.
     */
    internalIndex = {
      create: vi.fn(async () => ({ _id: "generated", _source: {} })),
      delete: vi.fn(async () => undefined),
      deleteByQuery: vi.fn(async () => ({ documents: [] })),
      get: vi.fn(async () => ({ _id: "some-id", _source: {} })),
      index: "%kuzzle",
      mExecute: vi.fn(async () => undefined),
      refreshCollection: vi.fn(async () => undefined),
      search: vi.fn(async () => ({ hits: [] })),
      update: vi.fn(async () => undefined),
    };

    stubKuzzle({ internalIndex });
  });

  afterEach(() => {
    restoreKuzzle();
    vi.restoreAllMocks();
  });

  describe("BaseModel.register", () => {
    it("defines a getter and a setter for every declared field", () => {
      const model = new Model();
      const expected: JSONObject = {};

      for (const field of Model.fields) {
        expected[field] = "some value";
        (model as unknown as JSONObject)[field] = "some value";

        expect((model as unknown as JSONObject)[field]).toBe("some value");
      }

      expect(model.__source).toMatchObject(expected);
    });

    it("keeps __persisted off the object's own enumerable keys", () => {
      const model = new Model();

      model.__persisted = true;

      expect(model.__persisted).toBe(true);
      expect(Object.keys(model)).not.toContain("__persisted");
    });

    /*
     * Not covered by the Mocha spec: the guard exists because registering
     * through a subclass would define the fields on the wrong prototype.
     */
    it("refuses to be called on anything but BaseModel itself", () => {
      expect(() => Model.register(Model)).toThrow(
        "Incorrect usage of BaseModel.register",
      );
    });
  });

  describe("BaseModel.getter/setter", () => {
    it("carries _id through to __id", () => {
      const model = new Model();

      model._id = "mylehuong";

      expect(model._id).toBe("mylehuong");
      expect(model.__id).toBe("mylehuong");
    });

    it("carries _source through to __source", () => {
      const model = new Model();

      model._source = { location: "thehive", name: "mylehuong" };

      expect(model._source).toEqual({
        location: "thehive",
        name: "mylehuong",
      });
      expect(model.__source).toEqual({
        location: "thehive",
        name: "mylehuong",
      });
    });

    /*
     * Not covered by the Mocha spec, which only ever assigned declared
     * fields: the setter is a filter, and it is what keeps a document read
     * from the database from carrying unknown keys back into it.
     */
    it("drops the keys the model does not declare", () => {
      const model = new Model();

      model._source = { name: "mylehuong", unknown: "dropped" };

      expect(model._source).toEqual({ name: "mylehuong" });
    });
  });

  describe("BaseModel.load", () => {
    it("instantiates a persisted model from the database", async () => {
      internalIndex.get.mockResolvedValue({
        _id: "mylehuong",
        _source: { location: "thehive", name: "mylehuong" },
      });

      const model = (await Model.load("mylehuong")) as Model;

      expect(internalIndex.get).toHaveBeenCalledWith("models", "mylehuong");
      expect(model._id).toBe("mylehuong");
      expect(model._source).toEqual({
        location: "thehive",
        name: "mylehuong",
      });
      expect(model.__persisted).toBe(true);
    });
  });

  describe("BaseModel.deleteByQuery", () => {
    beforeEach(() => {
      internalIndex.deleteByQuery.mockResolvedValue({
        documents: [
          { _id: "mylehuong", _source: {} },
          { _id: "thehive", _source: {} },
        ],
      });
    });

    it("deletes through the internal index and runs the hook on each document", async () => {
      const afterDelete = vi
        .spyOn(Model.prototype, "_afterDelete")
        .mockResolvedValue(undefined);

      await Model.deleteByQuery({ match_all: {} });

      expect(internalIndex.deleteByQuery).toHaveBeenCalledWith("models", {
        match_all: {},
      });
      expect(afterDelete).toHaveBeenCalledTimes(2);
    });

    it("refreshes the collection when asked to", async () => {
      vi.spyOn(Model.prototype, "_afterDelete").mockResolvedValue(undefined);

      await Model.deleteByQuery({ match_all: {} }, { refresh: "wait_for" });

      expect(internalIndex.refreshCollection).toHaveBeenCalledWith("models");
    });

    /* The negative the Mocha spec did not assert: `refresh` is opt-in. */
    it("does not refresh it otherwise", async () => {
      vi.spyOn(Model.prototype, "_afterDelete").mockResolvedValue(undefined);

      await Model.deleteByQuery({ match_all: {} });

      expect(internalIndex.refreshCollection).not.toHaveBeenCalled();
    });
  });

  describe("BaseModel.search", () => {
    it("instantiates a persisted model per hit", async () => {
      internalIndex.search.mockResolvedValue({
        hits: [
          { _id: "mylehuong", _source: { location: "Saigon" } },
          { _id: "thehive", _source: { location: "Hanoi" } },
        ],
      });

      const models = (await Model.search(
        { query: { match_all: {} } },
        { scroll: "5s" },
      )) as Model[];

      expect(internalIndex.search).toHaveBeenCalledWith(
        "models",
        { query: { match_all: {} } },
        { scroll: "5s" },
      );
      expect(models).toHaveLength(2);
      expect(models[0]._id).toBe("mylehuong");
      expect(models[0]._source).toEqual({ location: "Saigon" });
      expect(models[0].__persisted).toBe(true);
      expect(models[1]._id).toBe("thehive");
    });
  });

  describe("BaseModel.truncate", () => {
    it("deletes by a match_all query, carrying the refresh option", async () => {
      const deleteByQuery = vi
        .spyOn(Model, "deleteByQuery")
        .mockResolvedValue(undefined);

      await Model.truncate({ refresh: "wait_for" });

      expect(deleteByQuery).toHaveBeenCalledWith(
        { match_all: {} },
        { refresh: "wait_for" },
      );
    });
  });

  /* Not covered by the Mocha spec. */
  describe("BaseModel.batchExecute", () => {
    it("delegates to the internal index's mExecute", async () => {
      const callback = vi.fn();

      await Model.batchExecute({ match_all: {} }, callback);

      expect(internalIndex.mExecute).toHaveBeenCalledWith(
        "models",
        { match_all: {} },
        callback,
      );
    });
  });

  /*
   * Not covered by the Mocha spec: both throw rather than answer something
   * empty, which is what turns "this model forgot to declare its collection"
   * into an error naming the mistake instead of a query against `undefined`.
   */
  describe("BaseModel.collection / BaseModel.fields", () => {
    it("refuse to answer when a model does not override them", () => {
      expect(() => BaseModel.collection).toThrow(
        "Model.collection must be defined",
      );
      expect(() => BaseModel.fields).toThrow("Model.fields must be defined");
    });
  });

  describe("#save", () => {
    const _id = "mylehuong";
    const _source = { location: "Saigon" };

    beforeEach(() => {
      internalIndex.create.mockResolvedValue({ _id, _source });
    });

    it("creates the document when the model is not persisted yet", async () => {
      const model = new Model(_source, _id);

      await model.save({ refresh: "wait_for", userId: "aschen" });

      expect(internalIndex.create).toHaveBeenCalledWith(
        "models",
        { location: "Saigon" },
        { id: "mylehuong", refresh: "wait_for", userId: "aschen" },
      );
      expect(model.__persisted).toBe(true);
    });

    it("takes the generated id back from the database", async () => {
      const model = new Model(_source);

      await model.save();

      expect(internalIndex.create).toHaveBeenCalledWith(
        "models",
        { location: "Saigon" },
        { id: null, refresh: undefined, userId: null },
      );
      expect(model._id).toBe("mylehuong");
    });

    it("updates the document when the model is already persisted", async () => {
      const model = new Model(_source, _id);
      model.__persisted = true;

      await model.save({ refresh: "wait_for", userId: "aschen" });

      expect(internalIndex.update).toHaveBeenCalledWith(
        "models",
        "mylehuong",
        { location: "Saigon" },
        { refresh: "wait_for", userId: "aschen" },
      );
      expect(internalIndex.create).not.toHaveBeenCalled();
    });
  });

  describe("#delete", () => {
    it("deletes the document, runs the hook, and forgets it was persisted", async () => {
      const afterDelete = vi
        .spyOn(Model.prototype, "_afterDelete")
        .mockResolvedValue(undefined);
      const model = new Model({ location: "Saigon" }, "mylehuong");
      model.__persisted = true;

      await model.delete({ refresh: "wait_for" });

      expect(internalIndex.delete).toHaveBeenCalledWith("models", "mylehuong", {
        refresh: "wait_for",
      });
      expect(afterDelete).toHaveBeenCalledTimes(1);
      expect(model.__persisted).toBe(false);
    });

    it("does nothing when the model was never persisted", async () => {
      const afterDelete = vi.spyOn(Model.prototype, "_afterDelete");
      const model = new Model({ location: "Saigon" }, "mylehuong");

      await model.delete();

      expect(internalIndex.delete).not.toHaveBeenCalled();
      /* The Mocha spec asserted the delete; the hook is the other half. */
      expect(afterDelete).not.toHaveBeenCalled();
    });
  });

  describe("#serialize", () => {
    it("answers the document as the database holds it", () => {
      const model = new Model({ location: "Saigon" }, "mylehuong");

      expect(model.serialize()).toEqual({
        _id: "mylehuong",
        _source: { location: "Saigon" },
      });
    });
  });
});
