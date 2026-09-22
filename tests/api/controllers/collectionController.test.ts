import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NativeController } from "../../../lib/api/controllers/baseController";
import CollectionController from "../../../lib/api/controllers/collectionController";
import { KuzzleRequest } from "../../../lib/api/request";
import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { NotFoundError } from "../../../lib/kerror/errors/notFoundError";
import { SizeLimitError } from "../../../lib/kerror/errors/sizeLimitError";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

describe("#api/controllers/CollectionController", () => {
  const index = "%text";
  const collection = "unit-test-collectionController";

  let controller: CollectionController;
  let request: KuzzleRequest;
  let ask: ReturnType<typeof vi.fn>;
  let answers: Record<string, unknown>;
  let failing: Map<string, Error>;
  let validateFormat: ReturnType<typeof vi.fn>;
  let curateSpecification: ReturnType<typeof vi.fn>;
  let internalIndex: {
    createOrReplace: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    index: string;
    refreshCollection: ReturnType<typeof vi.fn>;
    scroll: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    answers = {
      "core:storage:public:collection:truncate": { acknowledged: true },
      "core:storage:public:collection:create": { acknowledged: true },
    };
    failing = new Map();

    ask = vi.fn(async (event: string) => {
      const error = failing.get(event);

      if (error) {
        throw error;
      }

      return answers[event];
    });

    /*
     * The specification actions go through `internalIndex` — the
     * InternalIndexHandler — not through the `core:storage:private:*` events
     * the Mocha spec asserted on. Those are the handler's, one layer down;
     * this is the same mis-aimed assertion the ObjectRepository port found in
     * L2b, in a second spec.
     */
    internalIndex = {
      createOrReplace: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
      get: vi.fn(async () => ({ _source: {} })),
      index: "%kuzzle",
      refreshCollection: vi.fn(async () => undefined),
      scroll: vi.fn(async () => ({ hits: [], scrollId: null, total: 0 })),
      search: vi.fn(async () => ({ hits: [], scrollId: null, total: 0 })),
    };

    validateFormat = vi.fn(async () => ({ isValid: true }));
    curateSpecification = vi.fn(async () => undefined);

    stubKuzzle({
      ask,
      config: {
        limits: { documentsFetchCount: 100 },
        services: { storageEngine: { defaults: { scrollTTL: "15s" } } },
      },
      internalIndex,
      pipe: async () => undefined,
      validation: { curateSpecification, validateFormat },
    });

    controller = new CollectionController();
    request = new KuzzleRequest({
      controller: "collection",
      index,
      collection,
    });
  });

  afterEach(() => {
    restoreKuzzle();
  });

  it("should inherit the base constructor", () => {
    expect(controller).toBeInstanceOf(NativeController);
  });

  describe("#updateMapping", () => {
    it("should reject if the body is missing", async () => {
      const rejection = controller.updateMapping(request);

      await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection).rejects.toMatchObject({
        id: "api.assert.body_required",
      });
    });

    it("should forward to the store module", async () => {
      const mappings = {
        dynamic: "false",
        _meta: "data",
        properties: "properties",
      };

      request.input.body = mappings;
      answers["core:storage:public:mappings:update"] = mappings;

      await expect(controller.updateMapping(request)).resolves.toMatchObject(
        mappings,
      );
      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:mappings:update",
        index,
        collection,
        mappings,
      );
    });
  });

  describe("#getMapping", () => {
    const mappings = {
      dynamic: "false",
      _meta: "data",
      properties: "properties",
    };

    beforeEach(() => {
      answers["core:storage:public:mappings:get"] = mappings;
    });

    it("should forward to the store module", async () => {
      await expect(controller.getMapping(request)).resolves.toMatchObject(
        mappings,
      );
      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:mappings:get",
        index,
        collection,
        { includeKuzzleMeta: false },
      );
    });

    it("should include the Kuzzle metadata when asked to", async () => {
      request.input.args.includeKuzzleMeta = true;

      await controller.getMapping(request);

      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:mappings:get",
        index,
        collection,
        { includeKuzzleMeta: true },
      );
    });
  });

  describe("#truncate", () => {
    it("should forward to the store module", async () => {
      await expect(controller.truncate(request)).resolves.toMatchObject({
        acknowledged: true,
      });
      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:collection:truncate",
        index,
        collection,
      );
    });
  });

  describe("#getSpecifications", () => {
    it("should read the specifications from the internal index", async () => {
      internalIndex.get.mockResolvedValue({ _source: { some: "validation" } });

      await expect(
        controller.getSpecifications(request),
      ).resolves.toMatchObject({ some: "validation" });

      expect(internalIndex.get).toHaveBeenCalledWith(
        "validations",
        `${index}#${collection}`,
      );
    });

    it("should give a meaningful message when there are none", async () => {
      internalIndex.get.mockRejectedValue(new NotFoundError("not found"));

      const rejection = controller.getSpecifications(request);

      await expect(rejection).rejects.toBeInstanceOf(NotFoundError);
      await expect(rejection).rejects.toMatchObject({
        id: "validation.assert.not_found",
      });
    });
  });

  describe("#searchSpecifications", () => {
    it("should reject a page size beyond the server's limit", async () => {
      global.kuzzle.config.limits.documentsFetchCount = 1;
      request.input.args.from = 0;
      request.input.args.size = 20;

      const rejection = controller.searchSpecifications(request);

      await expect(rejection).rejects.toBeInstanceOf(SizeLimitError);
      await expect(rejection).rejects.toMatchObject({
        id: "services.storage.get_limit_exceeded",
      });
    });

    it("should search the internal index", async () => {
      internalIndex.search.mockResolvedValue({
        hits: [{ _id: "bar" }],
        scrollId: "foobar",
        total: 123,
      });

      request = new KuzzleRequest({
        body: { query: { match_all: {} } },
        from: 0,
        size: 20,
        scroll: "15s",
      });

      await expect(
        controller.searchSpecifications(request),
      ).resolves.toMatchObject({
        total: 123,
        scrollId: "foobar",
        hits: [{ _id: "bar" }],
      });

      expect(internalIndex.search).toHaveBeenCalledWith(
        "validations",
        request.input.body,
        { from: 0, size: 20, scroll: "15s" },
      );
    });
  });

  describe("#scrollSpecifications", () => {
    beforeEach(() => {
      internalIndex.scroll.mockResolvedValue({
        hits: [{ _id: "bar" }],
        scrollId: "foobar",
        total: 123,
      });
    });

    it("should reject when no scrollId is provided", async () => {
      request = new KuzzleRequest({
        controller: "collection",
        action: "scrollSpecifications",
      });

      const rejection = controller.scrollSpecifications(request);

      await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection).rejects.toMatchObject({
        id: "api.assert.missing_argument",
      });
    });

    it("should scroll with the default TTL", async () => {
      request = new KuzzleRequest({ scrollId: "foobar" });

      await expect(
        controller.scrollSpecifications(request),
      ).resolves.toMatchObject({ total: 123, scrollId: "foobar" });

      // `defaultScrollTTL` is private; it is read from the configuration the
      // fixture sets, which is what the assertion is about.
      expect(internalIndex.scroll).toHaveBeenCalledWith("foobar", "15s");
    });

    it("should handle the optional scroll argument", async () => {
      request = new KuzzleRequest({ scrollId: "foobar", scroll: "qux" });

      await controller.scrollSpecifications(request);

      expect(internalIndex.scroll).toHaveBeenCalledWith("foobar", "qux");
    });
  });

  describe("#updateSpecifications", () => {
    const specifications = {
      strict: true,
      fields: {
        myField: { mandatory: true, type: "integer", defaultValue: 42 },
      },
    };

    it("should create or replace the specifications", async () => {
      request.input.body = specifications;

      await expect(
        controller.updateSpecifications(request),
      ).resolves.toMatchObject(specifications);

      expect(internalIndex.createOrReplace).toHaveBeenCalledWith(
        "validations",
        `${index}#${collection}`,
        { index, collection, validation: specifications },
      );
      expect(internalIndex.refreshCollection).toHaveBeenCalledWith(
        "validations",
      );
      expect(curateSpecification).toHaveBeenCalled();
    });

    it("should reject, and store nothing, when the specifications are wrong", async () => {
      request.input.body = {
        ...specifications,
        fields: { myField: { type: "zorglub" } },
      };
      validateFormat.mockResolvedValue({
        isValid: false,
        errors: ["zorglub is a bad type !"],
      });

      const rejection = controller.updateSpecifications(request);

      await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection).rejects.toMatchObject({
        id: "validation.assert.invalid_specifications",
      });

      expect(curateSpecification).not.toHaveBeenCalled();
      expect(internalIndex.createOrReplace).not.toHaveBeenCalled();
    });
  });

  describe("#validateSpecifications", () => {
    beforeEach(() => {
      request.input.body = {
        strict: true,
        fields: {
          myField: { mandatory: true, type: "integer", defaultValue: 42 },
        },
      };
    });

    it("should answer that valid specifications are valid", async () => {
      await expect(
        controller.validateSpecifications(request),
      ).resolves.toMatchObject({ valid: true });

      expect(validateFormat).toHaveBeenCalledWith(
        index,
        collection,
        request.input.body,
        true,
      );
    });

    it("should answer the errors of invalid ones", async () => {
      validateFormat.mockResolvedValue({ isValid: false, errors: "errors" });

      await expect(
        controller.validateSpecifications(request),
      ).resolves.toMatchObject({
        valid: false,
        details: "errors",
        description: "Some errors with provided specifications.",
      });
    });
  });

  describe("#deleteSpecifications", () => {
    it("should delete the specifications and refresh the collection", async () => {
      await expect(
        controller.deleteSpecifications(request),
      ).resolves.toMatchObject({ acknowledged: true });

      expect(internalIndex.delete).toHaveBeenCalledWith(
        "validations",
        `${index}#${collection}`,
      );
      expect(internalIndex.refreshCollection).toHaveBeenCalledWith(
        "validations",
      );
      expect(curateSpecification).toHaveBeenCalledOnce();
    });
  });

  describe("#list", () => {
    beforeEach(() => {
      answers["core:storage:public:collection:list"] = ["col", "loc"];
      answers["core:realtime:collections:get"] = ["foo", "bar"];
    });

    const listed = () =>
      ask.mock.calls.filter(
        ([event]) => event === "core:realtime:collections:get",
      );
    const stored = () =>
      ask.mock.calls.filter(
        ([event]) => event === "core:storage:public:collection:list",
      );

    it("should resolve to a full, sorted collections list", async () => {
      const response = await controller.list(request);

      expect(response.type).toBe("all");
      expect(response.collections).toEqual([
        { name: "bar", type: "realtime" },
        { name: "col", type: "stored" },
        { name: "foo", type: "realtime" },
        { name: "loc", type: "stored" },
      ]);
      expect(ask).toHaveBeenCalledWith("core:realtime:collections:get", index);
      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:collection:list",
        index,
      );
    });

    it('should reject an invalid "type" argument', async () => {
      request = new KuzzleRequest({ index: "index", type: "foo" });

      const rejection = controller.list(request);

      await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection).rejects.toMatchObject({
        id: "api.assert.invalid_argument",
      });
    });

    it("should only return stored collections with type = stored", async () => {
      request = new KuzzleRequest({ index: "index", type: "stored" });

      const response = await controller.list(request);

      expect(response.type).toBe("stored");
      expect(listed()).toHaveLength(0);
      expect(stored()).toHaveLength(1);
    });

    it("should only return realtime collections with type = realtime", async () => {
      request = new KuzzleRequest({ index: "index", type: "realtime" });

      const response = await controller.list(request);

      expect(response.type).toBe("realtime");
      expect(ask).toHaveBeenCalledWith(
        "core:realtime:collections:get",
        "index",
      );
      expect(stored()).toHaveLength(0);
    });

    describe("paging", () => {
      beforeEach(() => {
        answers["core:storage:public:collection:list"] = [
          "astored",
          "bstored",
          "cstored",
          "dstored",
          "estored",
        ];
        answers["core:realtime:collections:get"] = [
          "arealtime",
          "brealtime",
          "crealtime",
          "drealtime",
          "erealtime",
        ];
      });

      it("should honour from and size together", async () => {
        request = new KuzzleRequest({
          index: "index",
          type: "all",
          from: 2,
          size: 3,
        });

        const response = await controller.list(request);

        expect(response.collections).toEqual([
          { name: "brealtime", type: "realtime" },
          { name: "bstored", type: "stored" },
          { name: "crealtime", type: "realtime" },
        ]);
      });

      it("should honour from alone", async () => {
        request = new KuzzleRequest({ index: "index", type: "all", from: 8 });

        const response = await controller.list(request);

        expect(response.collections).toEqual([
          { name: "erealtime", type: "realtime" },
          { name: "estored", type: "stored" },
        ]);
      });

      it("should honour size alone", async () => {
        request = new KuzzleRequest({ index: "index", type: "all", size: 2 });

        const response = await controller.list(request);

        expect(response.collections).toEqual([
          { name: "arealtime", type: "realtime" },
          { name: "astored", type: "stored" },
        ]);
      });
    });

    it.each(["stored", "all"])(
      "should reject with type = %s if the store fails",
      async (type) => {
        failing.set("core:storage:public:collection:list", new Error("foobar"));
        request = new KuzzleRequest({ index: "index", type });

        await expect(controller.list(request)).rejects.toThrow("foobar");
      },
    );
  });

  describe("#exists / #refresh / #create / #delete", () => {
    it("should forward exists to the store module", async () => {
      answers["core:storage:public:collection:exist"] = true;

      await expect(controller.exists(request)).resolves.toBe(true);
      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:collection:exist",
        index,
        collection,
      );
    });

    it("should forward refresh to the store module", async () => {
      await expect(controller.refresh(request)).resolves.toBeNull();
      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:collection:refresh",
        index,
        collection,
      );
    });

    it("should forward create to the store module", async () => {
      await expect(controller.create(request)).resolves.toMatchObject({
        acknowledged: true,
      });
      // The mappings argument too: it defaults to `{}`, which the Mocha
      // spec's prefix-matching `calledWith` never mentioned.
      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:collection:create",
        index,
        collection,
        {},
      );
    });

    it("should forward delete to the store module", async () => {
      await expect(controller.delete(request)).resolves.toBeNull();
      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:collection:delete",
        index,
        collection,
      );
    });
  });
});
