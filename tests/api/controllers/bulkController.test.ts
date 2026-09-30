import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NativeController } from "../../../lib/api/controllers/baseController";
import BulkController from "../../../lib/api/controllers/bulkController";
import { KuzzleRequest } from "../../../lib/api/request";
import actionEnum from "../../../lib/core/realtime/actionEnum";
import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { MultipleErrorsError } from "../../../lib/kerror/errors/multipleErrorsError";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

/*
 * `test/mocks/mockAssertions.js` is not ported, and not replaced: it stubbed
 * six `assert*` methods on the subject, and `bulkController` calls none of
 * them — the same thing the indexController port found.
 */
describe("#api/controllers/BulkController", () => {
  const index = "nyc-open-data";
  const collection = "yellow-taxi";

  let controller: BulkController;
  let request: KuzzleRequest;
  let ask: ReturnType<typeof vi.fn>;
  let answers: Record<string, unknown>;

  beforeEach(() => {
    answers = {};
    ask = vi.fn(async (event: string) => answers[event]);

    stubKuzzle({ ask, pipe: async () => undefined });

    controller = new BulkController();
    request = new KuzzleRequest({ controller: "bulk", collection, index });
  });

  afterEach(() => {
    restoreKuzzle();
  });

  it("should inherit the base constructor", () => {
    expect(controller).toBeInstanceOf(NativeController);
  });

  describe("#import", () => {
    const bulkData = ["fake", "data"];

    beforeEach(() => {
      request.input.action = "bulk";
      request.input.body = { bulkData };
      answers["core:storage:public:document:bulk"] = {
        items: ["fake", "data"],
        errors: [],
      };
    });

    it("should forward to the storage engine and answer its result", async () => {
      await expect(controller.import(request)).resolves.toMatchObject({
        successes: ["fake", "data"],
        errors: [],
      });

      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:document:bulk",
        index,
        collection,
        bulkData,
        { refresh: "false", userId: null },
      );
    });

    it("should answer the errors it is given", async () => {
      answers["core:storage:public:document:bulk"] = {
        items: [],
        errors: ["fake", "data"],
      };

      await expect(controller.import(request)).resolves.toMatchObject({
        successes: [],
        errors: ["fake", "data"],
      });
    });

    it("should throw in strict mode if at least one import has failed", async () => {
      /*
       * ⚠️ Unasserted in the Mocha spec: `should(...).rejectedWith(...)` with
       * no `return` in front of it.
       */
      request.input.args.strict = true;
      answers["core:storage:public:document:bulk"] = {
        items: [],
        errors: ["fake", "data"],
      };

      const rejection = controller.import(request);

      await expect(rejection).rejects.toBeInstanceOf(MultipleErrorsError);
      await expect(rejection).rejects.toMatchObject({
        id: "api.process.incomplete_multiple_request",
      });
    });
  });

  describe("#write", () => {
    const _id = "tolkien";
    const _source = { name: "Feanor", silmarils: 3 };

    beforeEach(() => {
      request.input.action = "write";
      request.input.body = _source;
      request.input.args._id = _id;
      answers["core:storage:public:document:createOrReplace"] = {
        _id,
        _source,
        _version: 1,
        result: "created",
      };
    });

    it("should createOrReplace the document without injecting meta", async () => {
      await expect(controller.write(request)).resolves.toMatchObject({
        _id,
        _source,
        _version: 1,
      });

      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:document:createOrReplace",
        index,
        collection,
        _id,
        _source,
        { refresh: "false", injectKuzzleMeta: false },
      );
      expect(ask).not.toHaveBeenCalledWith(
        "core:realtime:document:notify",
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should send a "document written" notification when asked to', async () => {
      request.input.args.notify = true;
      answers["core:storage:public:document:createOrReplace"] = {
        _id,
        _source,
        _version: 1,
        result: "created",
        created: true,
      };

      await controller.write(request);

      expect(ask).toHaveBeenCalledWith(
        "core:realtime:document:notify",
        request,
        actionEnum.WRITE,
        expect.objectContaining({ _id, _source }),
      );
    });
  });

  describe("#mWrite", () => {
    const documents = [
      { name: "Maedhros" },
      { name: "Maglor" },
      { name: "Celegorm" },
    ];
    const written = [
      {
        _id: "maed",
        _source: { name: "Maedhros" },
        _version: 1,
        created: true,
      },
      { _id: "magl", _source: { name: "Maglor" }, _version: 1, created: true },
    ];

    beforeEach(() => {
      request.input.action = "write";
      request.input.body = { documents };
      answers["core:storage:public:document:mCreateOrReplace"] = {
        items: written,
        errors: [],
      };
    });

    it("should mCreateOrReplace the documents without injecting meta", async () => {
      await expect(controller.mWrite(request)).resolves.toMatchObject({
        successes: [
          { _id: "maed", _source: { name: "Maedhros" }, _version: 1 },
          { _id: "magl", _source: { name: "Maglor" }, _version: 1 },
        ],
        errors: [],
      });

      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:document:mCreateOrReplace",
        index,
        collection,
        documents,
        { refresh: "false", limits: false, injectKuzzleMeta: false },
      );
      expect(ask).not.toHaveBeenCalledWith(
        "core:realtime:document:mNotify",
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it("should notify when asked to", async () => {
      request.input.args.notify = true;

      await controller.mWrite(request);

      expect(ask).toHaveBeenCalledWith(
        "core:realtime:document:mNotify",
        request,
        actionEnum.WRITE,
        written,
      );
    });

    it("should throw in strict mode if at least one write has failed", async () => {
      /*
       * ⚠️ Doubly dead in the Mocha spec: the assertion had no `return`, and
       * the call under it was `controller.import(request)` — this describe's
       * subject is `mWrite`.
       */
      request.input.args.strict = true;
      answers["core:storage:public:document:mCreateOrReplace"] = {
        items: [],
        errors: [{ name: "Maedhros" }, { name: "Maglor" }],
      };

      const rejection = controller.mWrite(request);

      await expect(rejection).rejects.toBeInstanceOf(MultipleErrorsError);
      await expect(rejection).rejects.toMatchObject({
        id: "api.process.incomplete_multiple_request",
      });
    });
  });

  describe("#deleteByQuery", () => {
    const query = { range: { age: { gt: 21 } } };

    beforeEach(() => {
      request.input.action = "deleteByQuery";
      request.input.args.refresh = "wait_for";
      request.input.body = { query };
      answers["core:storage:public:document:deleteByQuery"] = { deleted: 2 };
    });

    it("should delete without fetching, and without a size limit", async () => {
      const response = await controller.deleteByQuery(request);

      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:document:deleteByQuery",
        index,
        collection,
        query,
        { refresh: "wait_for", fetch: false, size: -1 },
      );
      expect(response.deleted).toBe(2);
    });
  });

  describe("#updateByQuery", () => {
    const query = { match: { foo: "bar" } };
    const changes = { bar: "foo" };

    beforeEach(() => {
      request.input.body = { query, changes };
      answers["core:storage:public:bulk:updateByQuery"] = { updated: 1 };
    });

    it("should forward to the store module", async () => {
      request.input.args.refresh = "wait_for";

      await expect(controller.updateByQuery(request)).resolves.toEqual({
        updated: 1,
      });

      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:bulk:updateByQuery",
        index,
        collection,
        query,
        changes,
        { refresh: "wait_for" },
      );
    });

    it("should default the refresh parameter", async () => {
      await controller.updateByQuery(request);

      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:bulk:updateByQuery",
        index,
        collection,
        query,
        changes,
        { refresh: "false" },
      );
    });

    it("should reject a malformed body.query", async () => {
      request.input.body = { query: "not an object", changes };

      const rejection = controller.updateByQuery(request);

      await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection).rejects.toMatchObject({
        id: "api.assert.invalid_type",
        message: 'Wrong type for argument "body.query" (expected: object)',
      });
    });

    it("should reject a missing body.changes", async () => {
      request.input.body = { query, missingProperty: "changes" };

      const rejection = controller.updateByQuery(request);

      await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection).rejects.toMatchObject({
        id: "api.assert.missing_argument",
        message: 'Missing argument "body.changes".',
      });
    });
  });
});
