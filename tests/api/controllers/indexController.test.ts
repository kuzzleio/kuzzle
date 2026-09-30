import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NativeController } from "../../../lib/api/controllers/baseController";
import IndexController from "../../../lib/api/controllers/indexController";
import { KuzzleRequest } from "../../../lib/api/request";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

/*
 * `test/mocks/mockAssertions.js` is not ported, and not replaced: it stubbed
 * six `assert*` methods on the subject, and `indexController` calls none of
 * them. Mocking the subject's own surface is how that went unnoticed.
 */
describe("#api/controllers/IndexController", () => {
  const index = "text";
  const collection = "unit-test-indexController";

  let controller: IndexController;
  let ask: ReturnType<typeof vi.fn>;
  let request: KuzzleRequest;

  beforeEach(() => {
    /*
     * Every action on this controller is one `ask` to the storage engine, so
     * `ask` is the whole fixture — the constructor takes `pipe` too, from the
     * native base class.
     */
    ask = vi.fn(async () => undefined);
    stubKuzzle({ ask, pipe: async () => undefined });

    controller = new IndexController();
    request = new KuzzleRequest({ collection, controller: "index", index });
  });

  afterEach(() => {
    restoreKuzzle();
  });

  it("inherits the native controller", () => {
    expect(controller).toBeInstanceOf(NativeController);
  });

  describe("#mDelete", () => {
    beforeEach(() => {
      ask.mockImplementation(async (event: string) => {
        if (event === "core:storage:public:index:list") {
          return ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
        }
        if (event === "core:storage:public:index:mDelete") {
          return ["a", "e", "i"];
        }
        return undefined;
      });

      request.input.body = { indexes: ["a", "c", "e", "g", "i"] };
    });

    it("deletes the indexes the user is allowed to delete", async () => {
      /* Allowed on every other index, in request order: a, e, i. */
      const isActionAllowed = vi
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      request.context.token = { userId: "42" } as never;
      request.context.user = { isActionAllowed } as never;

      const response = await controller.mDelete(request);

      expect(isActionAllowed).toHaveBeenCalledTimes(5);
      expect(ask).toHaveBeenCalledWith("core:storage:public:index:mDelete", [
        "a",
        "e",
        "i",
      ]);
      expect(response).toEqual({ deleted: ["a", "e", "i"] });
    });

    it("skips the rights check when called through the embedded SDK", async () => {
      request.context.token = null as never;
      request.context.user = null as never;

      await controller.mDelete(request);

      expect(ask).toHaveBeenCalledWith("core:storage:public:index:mDelete", [
        "a",
        "c",
        "e",
        "g",
        "i",
      ]);
    });

    /*
     * Not covered by the Mocha spec: the list from the storage engine is what
     * the body is filtered *against*, so an index the user names but that does
     * not exist must not reach the delete.
     */
    it("ignores an index the storage engine does not list", async () => {
      request.input.body = { indexes: ["a", "does-not-exist"] };
      request.context.token = null as never;
      request.context.user = null as never;

      await controller.mDelete(request);

      expect(ask).toHaveBeenCalledWith("core:storage:public:index:mDelete", [
        "a",
      ]);
    });
  });

  describe("#create", () => {
    it("asks the storage engine to create the index", async () => {
      expect(await controller.create(request)).toBeUndefined();
      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:index:create",
        index,
      );
    });
  });

  describe("#delete", () => {
    it("asks the storage engine to delete the index", async () => {
      expect(await controller.delete(request)).toEqual({ acknowledged: true });
      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:index:delete",
        index,
      );
    });
  });

  describe("#list", () => {
    it("returns the indexes the storage engine lists", async () => {
      ask.mockResolvedValue(["a", "b", "c"]);

      expect(await controller.list(request)).toEqual({
        indexes: ["a", "b", "c"],
      });
      expect(ask).toHaveBeenCalledWith("core:storage:public:index:list");
    });
  });

  describe("#exists", () => {
    it("returns what the storage engine answers", async () => {
      ask.mockResolvedValue(true);

      expect(await controller.exists(request)).toBe(true);
      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:index:exist",
        index,
      );
    });
  });

  describe("#stats", () => {
    /*
     * `stats()` takes no argument. The Mocha spec handed it a request, which
     * JavaScript ignored silently and TS2554 refused — the same class of
     * defect the L1 port turned up three times.
     */
    it("returns what the storage engine answers", async () => {
      ask.mockResolvedValue(true);

      expect(await controller.stats()).toBe(true);
      expect(ask).toHaveBeenCalledWith("core:storage:public:index:stats");
    });
  });
});
