import type { JSONObject } from "kuzzle-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NativeController } from "../../../lib/api/controllers/baseController";
import DocumentController from "../../../lib/api/controllers/documentController";
import { Request } from "../../../lib/api/request/kuzzleRequest";
import actionEnum from "../../../lib/core/realtime/actionEnum";
import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { MultipleErrorsError } from "../../../lib/kerror/errors/multipleErrorsError";
import { SizeLimitError } from "../../../lib/kerror/errors/sizeLimitError";
import { invalid } from "../../helpers/invalid";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

const index = "festivals";
const collection = "huma";

describe("#api/controllers/documentController", () => {
  let controller: DocumentController;
  let request: Request;

  let ask: ReturnType<typeof vi.fn>;
  let answers: Record<string, unknown>;
  let failures: Map<string, Error>;
  let validate: ReturnType<typeof vi.fn>;
  let limits: { documentsFetchCount: number; documentsWriteCount: number };

  beforeEach(() => {
    answers = {};
    failures = new Map();

    ask = vi.fn(async (event: string, ...args: unknown[]) => {
      const failure = failures.get(event);

      if (failure) {
        throw failure;
      }

      const answer = answers[event];

      return typeof answer === "function" ? answer(...args) : answer;
    });

    /** `validation.validate` answers its own first argument by default. */
    validate = vi.fn(async (req: unknown) => req);

    limits = { documentsFetchCount: 10000, documentsWriteCount: 200 };

    stubKuzzle({
      ask,
      config: { limits },
      id: "knode-test",
      pipe: async (_event: string, payload: unknown) => payload,
      pluginsManager: { listStrategies: () => [] },
      validation: { validate },
    });

    controller = new DocumentController();

    request = new Request({ collection, controller: "document", index });
  });

  afterEach(() => {
    restoreKuzzle();
    vi.restoreAllMocks();
  });

  const asked = (event: string) =>
    ask.mock.calls.filter(([name]) => name === event);

  const rejects = async (
    promise: Promise<unknown>,
    match: JSONObject,
    error:
      | typeof BadRequestError
      | typeof MultipleErrorsError
      | typeof SizeLimitError = BadRequestError,
  ) => {
    await expect(promise).rejects.toBeInstanceOf(error);
    await expect(promise).rejects.toMatchObject(match);
  };

  /**
   * What `silent: true` actually owes.
   *
   * The Mocha spec wrote this as
   * `should(kuzzle.ask).not.be.calledWithMatch("core:realtime:document:notify",
   * request, actionEnum.CREATE, { _id: "_id", _source: "_source" })` — copied
   * from `#create` into ten other blocks without changing the action. For
   * `update`, `replace`, `delete` and the rest, the real notification never
   * carries `actionEnum.CREATE`, so **nine of those eleven assertions could
   * not fail even with `silent` unset.** What the flag means is that nothing
   * is notified at all.
   */
  const expectNoNotification = () => {
    expect(asked("core:realtime:document:notify")).toHaveLength(0);
    expect(asked("core:realtime:document:mNotify")).toHaveLength(0);
  };

  /**
   * The body the controller actually hands to the store.
   *
   * It injects `_kuzzle_info` itself and passes `injectKuzzleMeta: false` so
   * the storage layer does not do it a second time. The Mocha spec asserted
   * the body with `calledWithMatch`, which is a PARTIAL match, so nothing in
   * the suite said the metadata is added at all — or by whom.
   */
  const bodyWithMeta = (content: JSONObject, meta: JSONObject) => ({
    ...content,
    _kuzzle_info: meta,
  });

  /** `create`: authored now, never updated. */
  const createdMeta = (userId: string | null = null) => ({
    author: userId,
    createdAt: expect.any(Number),
    updatedAt: null,
    updater: null,
  });

  /** `update` and `upsert`: only the update half. */
  const updatedMeta = (userId: string | null = null) => ({
    updatedAt: expect.any(Number),
    updater: userId,
  });

  /**
   * `createOrReplace` and `replace` both go through `_writeDocument`, which
   * stamps both halves at once.
   */
  const replacedMeta = (userId: string | null = null) => ({
    author: userId,
    createdAt: expect.any(Number),
    updatedAt: expect.any(Number),
    updater: userId,
  });

  /**
   * `upsert`'s `default` values are stamped too, with their own shorter
   * metadata — which the Mocha spec's partial match never reached either.
   */
  const defaultsWithMeta = (
    defaults: JSONObject,
    userId: string | null = null,
  ) => ({
    ...defaults,
    _kuzzle_info: { author: userId, createdAt: expect.any(Number) },
  });

  /** The instance methods the spec stubs on the controller. */
  const internalsOf = (c: DocumentController) =>
    invalid<{
      assertTargetsAreValid: (targets: unknown) => void;
      translateKoncorde: (query: unknown) => Promise<unknown>;
    }>(c);

  describe("#constructor", () => {
    it("should inherit the base constructor", () => {
      expect(controller).toBeInstanceOf(NativeController);
    });
  });

  describe("#search", () => {
    const searchEvent = "core:storage:public:document:search";

    beforeEach(() => {
      answers[searchEvent] = {
        aggregations: "aggregations",
        hits: "hits",
        other: "other",
        remaining: "remaining",
        scrollId: "scrollId",
        total: "total",
      };
    });

    it("should forward to the store module", async () => {
      request.input.body = { query: { bar: "bar " } };
      request.input.args.from = 1;
      request.input.args.size = 3;
      request.input.args.scroll = "10s";

      const response = await controller.search(request);

      expect(ask).toHaveBeenCalledWith(
        searchEvent,
        index,
        collection,
        { query: { bar: "bar " } },
        { from: 1, scroll: "10s", size: 3 },
      );

      /* `toEqual`, not `toMatchObject`: the point of this assertion is that
       * `other` is dropped, and a partial match cannot say that. */
      expect(response).toEqual({
        aggregations: "aggregations",
        hits: "hits",
        remaining: "remaining",
        scrollId: "scrollId",
        total: "total",
      });
    });

    it("should reject if index contains a comma", async () => {
      request.input.args.index = "%test,anotherIndex";
      request.input.action = "search";

      await rejects(controller.search(request), {
        id: "services.storage.invalid_multi_index_collection_usage",
      });
    });

    it("should reject if collection contains a comma", async () => {
      request.input.args.collection =
        "unit-test-documentController,anotherCollection";
      request.input.action = "search";

      await rejects(controller.search(request), {
        id: "services.storage.invalid_multi_index_collection_usage",
      });
    });

    it("should reject if no index and collection or targets are specified", async () => {
      request.input.args.index = undefined;
      request.input.args.collection = undefined;
      request.input.args.targets = undefined;
      request.input.action = "search";

      await rejects(controller.search(request), {
        id: "api.assert.missing_argument",
      });
    });

    it("should reject if no index is provided and there is no target", async () => {
      request.input.args.index = undefined;
      request.input.args.collection = "foo";
      request.input.args.targets = undefined;
      request.input.action = "search";

      await rejects(controller.search(request), {
        id: "api.assert.missing_argument",
        message: 'Missing argument "index".',
      });
    });

    it("should reject if no collection is provided and there is no target", async () => {
      request.input.args.index = "foo";
      request.input.args.collection = undefined;
      request.input.args.targets = undefined;
      request.input.action = "search";

      await rejects(controller.search(request), {
        id: "api.assert.missing_argument",
        message: 'Missing argument "collection".',
      });
    });

    const withTargets = () => {
      request.input.args.index = null;
      request.input.args.collection = null;
      request.input.args.targets = [{ collections: ["bar"], index: "foo" }];
      request.input.action = "search";

      answers["core:storage:public:document:multiSearch"] = {
        hits: "hits",
        other: "other",
        remaining: "remaining",
        scrollId: "scrollId",
        total: "total",
      };
    };

    it("should verify that targets are valid", async () => {
      withTargets();

      const assertTargets = vi
        .spyOn(internalsOf(controller), "assertTargetsAreValid")
        .mockReturnValue(undefined);

      await controller.search(request);

      expect(assertTargets).toHaveBeenCalledWith([
        { collections: ["bar"], index: "foo" },
      ]);
    });

    it("should ask document:multiSearch when specifiying targets", async () => {
      withTargets();

      await controller.search(request);

      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:document:multiSearch",
        [{ collections: ["bar"], index: "foo" }],
        {},
        { from: 0, scroll: undefined, size: 10 },
      );
    });

    it("should reject if the size argument exceeds server configuration", async () => {
      limits.documentsFetchCount = 1;
      request.input.args.size = 10;
      request.input.action = "search";

      await rejects(
        controller.search(request),
        { id: "services.storage.get_limit_exceeded" },
        SizeLimitError,
      );
    });

    it("should reject in case of error", async () => {
      const error = new Error("foobar");

      failures.set(searchEvent, error);

      await expect(controller.search(request)).rejects.toBe(error);
    });

    it('should reject if the "lang" is not supported, with no body', async () => {
      request.input.args.lang = "turkish";

      await rejects(controller.search(request), {
        id: "api.assert.invalid_argument",
      });
    });

    it('should reject if the "lang" is not supported, with a body', async () => {
      // The Mocha spec gave these two tests the same name.
      request.input.body = { query: { foo: "bar" } };
      request.input.args.lang = "turkish";

      await rejects(controller.search(request), {
        id: "api.assert.invalid_argument",
      });
    });

    it('should call the "translateKoncorde" method if "lang" is "koncorde"', async () => {
      request.input.body = { query: { equals: { name: "Melis" } } };
      request.input.args.lang = "koncorde";

      const translate = vi
        .spyOn(internalsOf(controller), "translateKoncorde")
        .mockResolvedValue(undefined);

      await controller.search(request);

      expect(translate).toHaveBeenCalledWith({ equals: { name: "Melis" } });
    });
  });

  describe("#scroll", () => {
    const scrollEvent = "core:storage:public:document:scroll";

    beforeEach(() => {
      request.input.args.scroll = "1m";
      request.input.args.scrollId = "SomeScrollIdentifier";
    });

    it("should forward to the store module", async () => {
      answers[scrollEvent] = {
        hits: "hits",
        other: "other",
        remaining: "remaining",
        scrollId: "scrollId",
        total: "total",
      };

      const response = await controller.scroll(request);

      expect(ask).toHaveBeenCalledWith(scrollEvent, "SomeScrollIdentifier", {
        scrollTTL: "1m",
      });

      // `other` is dropped; `toEqual` is what says so.
      expect(response).toEqual({
        hits: "hits",
        remaining: "remaining",
        scrollId: "scrollId",
        total: "total",
      });
    });

    it("should reject in case of error", async () => {
      const error = new Error("foobar");

      failures.set(scrollEvent, error);

      await expect(controller.scroll(request)).rejects.toBe(error);
    });
  });

  describe("#exists", () => {
    it("should forward to the store module", async () => {
      answers["core:storage:public:document:exist"] = true;
      request.input.args._id = "foo";

      await expect(controller.exists(request)).resolves.toBe(true);

      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:document:exist",
        index,
        collection,
        "foo",
      );
    });
  });

  describe("#mExists", () => {
    const mExistsEvent = "core:storage:public:document:mExists";

    beforeEach(() => {
      request.input.body = { ids: ["id", "id2"] };

      answers[mExistsEvent] = {
        errors: [],
        items: [
          { _id: "id", _version: 1, some: "some" },
          { _id: "id2", _version: 1, some: "some" },
        ],
      };
    });

    it("should forward to the store module", async () => {
      await expect(controller.mExists(request)).resolves.toMatchObject({
        errors: [],
        successes: [
          { _id: "id", _version: 1 },
          { _id: "id2", _version: 1 },
        ],
      });

      expect(ask).toHaveBeenCalledWith(mExistsEvent, index, collection, [
        "id",
        "id2",
      ]);
    });

    it("should throw an error if the number of documents to get exceeds server configuration", async () => {
      // The Mocha spec neither returned nor awaited this one.
      limits.documentsFetchCount = 1;

      await rejects(
        controller.mExists(request),
        { id: "services.storage.get_limit_exceeded" },
        SizeLimitError,
      );
    });

    it("should handle errors if some documents are missing", async () => {
      answers[mExistsEvent] = {
        errors: ["id2"],
        items: [{ _id: "id", _version: 1, some: "some" }],
      };

      await expect(controller.mExists(request)).resolves.toMatchObject({
        errors: ["id2"],
        successes: [{ _id: "id", _version: 1 }],
      });
    });

    it("should throw an error in strict mode if at least one document is missing", async () => {
      request.input.args.strict = true;
      answers[mExistsEvent] = {
        errors: ["id2"],
        items: [{ _id: "id", _version: 1, some: "some" }],
      };

      await rejects(
        controller.mExists(request),
        { id: "api.process.incomplete_multiple_request" },
        MultipleErrorsError,
      );
    });
  });

  describe("#get", () => {
    it("should forward to the store module", async () => {
      answers["core:storage:public:document:get"] = {
        _id: "_id",
        _source: "_source",
        _version: "_version",
        some: "other",
      };
      request.input.args._id = "foo";

      await expect(controller.get(request)).resolves.toEqual({
        _id: "_id",
        _source: "_source",
        _version: "_version",
      });

      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:document:get",
        index,
        collection,
        "foo",
      );
    });
  });

  describe("#export", () => {
    const searchEvent = "core:storage:public:document:search";

    beforeEach(() => {
      answers[searchEvent] = { body: "stream", hits: [], scrollId: null };
      request.context.connection.protocol = "http";
      request.input.body = {
        collapse: { field: "category" },
        query: { term: { category: "books" } },
      };
    });

    /** `export` answers a stream; nothing is asked until it is drained. */
    const drain = async (response: unknown) => {
      const { stream } = invalid<{ stream: NodeJS.ReadableStream }>(response);

      stream.resume();

      await new Promise((resolve) => stream.on("end", resolve));
    };

    it("should forward collapse to the dumper search body", async () => {
      await drain(await controller.export(request));

      expect(ask).toHaveBeenCalledWith(
        searchEvent,
        index,
        collection,
        expect.objectContaining({ collapse: { field: "category" } }),
        { lang: "elasticsearch", scroll: undefined, size: 10 },
      );
    });

    it("should not forward collapse when it is not provided", async () => {
      request.input.body = { query: { term: { category: "books" } } };

      await drain(await controller.export(request));

      expect(ask).toHaveBeenCalledWith(
        searchEvent,
        index,
        collection,
        expect.objectContaining({ query: { term: { category: "books" } } }),
        expect.anything(),
      );
      expect(asked(searchEvent)[0][3]).not.toHaveProperty("collapse");
    });

    it("should reject unsupported protocols", async () => {
      request.context.connection.protocol = "mqtt";

      await expect(controller.export(request)).rejects.toThrow(
        'The protocol "mqtt" is not supported by the API action "document:export".',
      );
    });

    it("should translate koncorde queries before exporting", async () => {
      request.input.args.lang = "koncorde";

      const translate = vi
        .spyOn(internalsOf(controller), "translateKoncorde")
        .mockResolvedValue({ match: { title: "book" } });

      await drain(await controller.export(request));

      expect(translate).toHaveBeenCalledWith({ term: { category: "books" } });
      expect(ask).toHaveBeenCalledWith(
        searchEvent,
        index,
        collection,
        expect.objectContaining({
          collapse: { field: "category" },
          query: { match: { title: "book" } },
        }),
        { lang: "koncorde", scroll: undefined, size: 10 },
      );
    });

    it("should configure csv exports with the csv content type", async () => {
      request.input.args.format = "csv";

      await controller.export(request);

      expect(request.response.headers).toMatchObject({
        "Content-Disposition": `attachment; filename="${index}-${collection}.csv"`,
        "Content-Type": "text/csv",
      });
    });
  });

  describe("#mGet", () => {
    const mGetEvent = "core:storage:public:document:mGet";

    beforeEach(() => {
      request.input.body = { ids: ["id", "id2"] };

      answers[mGetEvent] = {
        errors: [],
        items: [
          { _id: "id", _source: "source", _version: 1, some: "some" },
          { _id: "id2", _source: "source", _version: 1, some: "some" },
        ],
      };
    });

    it("should forward to the store module", async () => {
      await expect(controller.mGet(request)).resolves.toMatchObject({
        errors: [],
        successes: [
          { _id: "id", _source: "source", _version: 1 },
          { _id: "id2", _source: "source", _version: 1 },
        ],
      });

      expect(ask).toHaveBeenCalledWith(mGetEvent, index, collection, [
        "id",
        "id2",
      ]);
    });

    it("should throw an error if the number of documents to get exceeds server configuration", async () => {
      // The Mocha spec neither returned nor awaited this one.
      limits.documentsFetchCount = 1;

      await rejects(
        controller.mGet(request),
        { id: "services.storage.get_limit_exceeded" },
        SizeLimitError,
      );
    });

    it("should handle errors if some documents are missing", async () => {
      answers[mGetEvent] = {
        errors: ["id2"],
        items: [{ _id: "id", _source: "source", _version: 1, some: "some" }],
      };

      await expect(controller.mGet(request)).resolves.toMatchObject({
        errors: ["id2"],
        successes: [{ _id: "id", _source: "source", _version: 1 }],
      });
    });

    it("should throw an error in strict mode if at least one document is missing", async () => {
      request.input.args.strict = true;
      answers[mGetEvent] = {
        errors: ["id2"],
        items: [{ _id: "id", _source: "source", _version: 1, some: "some" }],
      };

      await rejects(
        controller.mGet(request),
        { id: "api.process.incomplete_multiple_request" },
        MultipleErrorsError,
      );
    });
  });

  describe("#count", () => {
    it("should forward to the store module", async () => {
      answers["core:storage:public:document:count"] = 42;
      request.input.body = { query: {} };

      await expect(controller.count(request)).resolves.toEqual({ count: 42 });

      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:document:count",
        index,
        collection,
        { query: {} },
      );
    });
  });

  describe("#create", () => {
    const content = { foo: "bar" };

    beforeEach(() => {
      request.input.body = content;

      answers["core:storage:public:document:create"] = {
        _id: "_id",
        _source: "_source",
        _version: "_version",
      };
    });

    it('should not notify with "silent" argument', async () => {
      request.input.args.silent = true;

      await controller.create(request);

      expectNoNotification();
    });

    it("should forward to the store module and notify", async () => {
      request.input.args._id = "foobar";
      request.context.user = invalid({ _id: "aschen" });
      request.input.args.refresh = "wait_for";

      await expect(controller.create(request)).resolves.toMatchObject({
        _id: "_id",
        _source: "_source",
        _version: "_version",
      });

      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:document:create",
        index,
        collection,
        bodyWithMeta(content, createdMeta("aschen")),
        {
          id: "foobar",
          injectKuzzleMeta: false,
          refresh: "wait_for",
          userId: "aschen",
        },
      );

      expect(validate).toHaveBeenCalledWith(request, false);

      expect(ask).toHaveBeenCalledWith(
        "core:realtime:document:notify",
        request,
        actionEnum.CREATE,
        // `_version` too: the Mocha spec's `calledWithMatch` is partial and
        // never mentioned it.
        { _id: "_id", _source: "_source", _version: "_version" },
      );
    });

    it("should have default value for refresh, userId and id", async () => {
      await controller.create(request);

      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:document:create",
        index,
        collection,
        bodyWithMeta(content, createdMeta(null)),
        { id: null, injectKuzzleMeta: false, refresh: "false", userId: null },
      );
    });
  });

  describe("#_mChanges", () => {
    const mCreateEvent = "core:storage:public:document:mCreate";
    let documents: JSONObject[];
    let items: JSONObject[];

    const mChanges = (method: string, action: unknown) =>
      invalid<{
        _mChanges: (r: Request, m: string, a: unknown) => Promise<JSONObject>;
      }>(controller)._mChanges(request, method, action);

    beforeEach(() => {
      documents = [
        { _id: "_id1", body: { field: "_source" } },
        { _id: "_id2", body: { field: "_source" } },
        { _id: "_id3", body: { field: "_source" } },
      ];

      request.input.body = { documents };

      items = ["_id1", "_id2", "_id3"].map((id) => ({
        _id: id,
        _source: { field: "_source" },
        _version: "_version",
        created: true,
        result: "created",
      }));

      for (const event of ["mCreate", "mUpdate", "mUpsert"]) {
        answers[`core:storage:public:document:${event}`] = {
          errors: [],
          items,
        };
      }
    });

    it('should not notify with "silent" argument', async () => {
      request.input.args.silent = true;

      await mChanges("mCreate", actionEnum.CREATE);

      expectNoNotification();
    });

    it("should forward to the store module and notify the changes", async () => {
      request.context.user = invalid({ _id: "aschen" });
      request.input.args.refresh = "wait_for";

      await expect(
        mChanges("mCreate", actionEnum.CREATE),
      ).resolves.toMatchObject({ errors: [], successes: items });

      expect(ask).toHaveBeenCalledWith(
        mCreateEvent,
        index,
        collection,
        documents,
        {
          refresh: "wait_for",
          retryOnConflict: undefined,
          source: true,
          userId: "aschen",
        },
      );

      expect(ask).toHaveBeenCalledWith(
        "core:realtime:document:mNotify",
        request,
        actionEnum.CREATE,
        items,
      );
    });

    it("should have default values for userId, refresh and retryOnConflict params", async () => {
      await mChanges("mCreate", actionEnum.CREATE);

      expect(ask).toHaveBeenCalledWith(
        mCreateEvent,
        index,
        collection,
        documents,
        {
          refresh: "false",
          retryOnConflict: undefined,
          source: true,
          userId: null,
        },
      );
    });

    it("should handle errors if some actions failed", async () => {
      const errors = [
        {
          document: { _id: "_id42", _source: "_source" },
          reason: "reason",
          status: 206,
        },
      ];

      answers[mCreateEvent] = { errors, items };

      await expect(
        mChanges("mCreate", actionEnum.CREATE),
      ).resolves.toMatchObject({ errors, successes: items });
    });

    it('should reject if users give document with "_source" property', async () => {
      request.input.body.documents = [
        { _id: "doc-1", body: {} },
        { _id: "doc-2", _source: {} },
      ];

      await rejects(mChanges("mCreate", actionEnum.CREATE), {
        id: "api.assert.unexpected_argument",
      });
    });

    it("should reject if the number of documents to edit exceeds server configuration", async () => {
      limits.documentsWriteCount = 1;

      await rejects(
        mChanges("foobar", actionEnum.CREATE),
        { id: "services.storage.write_limit_exceeded" },
        SizeLimitError,
      );
    });

    it("should return immediately if the provided payload is empty", async () => {
      request.input.body.documents = [];

      await expect(
        mChanges("mCreate", actionEnum.CREATE),
      ).resolves.toMatchObject({ errors: [], successes: [] });

      expect(asked(mCreateEvent)).toHaveLength(0);
      expect(asked("core:realtime:document:mNotify")).toHaveLength(0);
    });

    it("should throw an error in strict mode if at least one action has failed", async () => {
      request.input.args.strict = true;
      answers[mCreateEvent] = {
        errors: [
          {
            document: { _id: "_id42", _source: "_source" },
            reason: "reason",
            status: 400,
          },
        ],
        items,
      };

      await rejects(
        mChanges("mCreate", actionEnum.CREATE),
        { id: "api.process.incomplete_multiple_request" },
        MultipleErrorsError,
      );
    });

    it("should retrieve retryOnConflict param when updating", async () => {
      request.input.args.retryOnConflict = 2;

      await mChanges("mUpdate", actionEnum.UPDATE);

      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:document:mUpdate",
        index,
        collection,
        documents,
        { refresh: "false", retryOnConflict: 2, source: true, userId: null },
      );
    });

    it("should retrieve retryOnConflict param doing an upsert", async () => {
      request.input.args.retryOnConflict = 2;

      await mChanges("mUpsert", actionEnum.UPSERT);

      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:document:mUpsert",
        index,
        collection,
        documents,
        { refresh: "false", retryOnConflict: 2, source: true, userId: null },
      );
    });

    it("should not check retryOnConflict param when not performing an update/upsert", async () => {
      request.input.args.retryOnConflict = 2;

      await mChanges("mCreate", actionEnum.CREATE);

      expect(ask).toHaveBeenCalledWith(
        mCreateEvent,
        index,
        collection,
        documents,
        {
          refresh: "false",
          retryOnConflict: undefined,
          source: true,
          userId: null,
        },
      );
    });

    it("should notify with _updatedFields when updating ", async () => {
      for (const item of items) {
        item.created = false;
      }

      await mChanges("mUpdate", actionEnum.UPDATE);

      expect(ask).toHaveBeenCalledWith(
        "core:realtime:document:mNotify",
        request,
        actionEnum.UPDATE,
        items.map((item) => ({ ...item, _updatedFields: ["field"] })),
      );
    });

    it("should notify with _updatedFields when doing an upsert ", async () => {
      request.input.body.documents = ["_id1", "_id2", "_id3"].map((id) => ({
        _id: id,
        changes: { field: "_source" },
        default: { field2: "default" },
      }));

      items[0].created = false;
      items[1].created = false;

      await mChanges("mUpsert", actionEnum.UPSERT);

      expect(ask).toHaveBeenCalledWith(
        "core:realtime:document:mNotify",
        request,
        actionEnum.UPSERT,
        [
          { ...items[0], _updatedFields: ["field"] },
          { ...items[1], _updatedFields: ["field"] },
          items[2],
        ],
      );
    });
  });

  describe("#mCreateOrReplace", () => {
    const event = "core:storage:public:document:mCreateOrReplace";
    let documents: JSONObject[];
    let items: JSONObject[];

    const mChanges = () =>
      invalid<{
        _mChanges: (r: Request, m: string, a: unknown) => Promise<JSONObject>;
      }>(controller)._mChanges(request, "mCreateOrReplace", actionEnum.WRITE);

    beforeEach(() => {
      documents = ["_id1", "_id2", "_id3"].map((id) => ({
        _id: id,
        body: { field: "_source" },
      }));

      request.input.body = { documents };

      items = ["_id1", "_id2", "_id3"].map((id) => ({
        _id: id,
        _source: { field: "_source" },
        _version: "_version",
        created: true,
        result: "created",
      }));

      /*
       * Keyed on the `source` option rather than stubbed twice on the whole
       * argument list. The Mocha spec registered two `withArgs` stubs and built
       * the second's answer with `items.map(item => { delete item._source; … })`
       * — which MUTATES the array the first one had already captured, so both
       * resolved documents with no `_source`.
       */
      answers[event] = (
        _index: string,
        _collection: string,
        _documents: unknown,
        options: JSONObject,
      ) => ({
        errors: [],
        items: options.source
          ? items
          : items.map((item) => {
              const withoutSource = { ...item };

              delete withoutSource._source;

              return withoutSource;
            }),
      });
    });

    it("should return success result of mCreateOrReplace with _source for each documents", async () => {
      request.input.args.silent = true;
      request.input.args.source = true;

      const response = await mChanges();

      expect(ask).toHaveBeenCalledWith(event, index, collection, documents, {
        refresh: "false",
        retryOnConflict: undefined,
        source: true,
        userId: null,
      });

      /* The Mocha spec set `_source` — the subject reads `source` — and then
       * asserted nothing about the documents it is named after. */
      for (const item of response.successes) {
        expect(item._source).toEqual({ field: "_source" });
      }
    });

    it("should return success result of mCreateOrReplace without _source for each documents", async () => {
      request.input.args.silent = true;
      request.input.args.source = false;

      const response = await mChanges();

      expect(ask).toHaveBeenCalledWith(event, index, collection, documents, {
        refresh: "false",
        retryOnConflict: undefined,
        source: false,
        userId: null,
      });

      for (const item of response.successes) {
        expect(item).not.toHaveProperty("_source");
      }
    });

    it("should default to asking for the source", async () => {
      request.input.args.silent = true;

      await mChanges();

      expect(ask).toHaveBeenCalledWith(event, index, collection, documents, {
        refresh: "false",
        retryOnConflict: undefined,
        source: true,
        userId: null,
      });
    });
  });

  describe("#createOrReplace", () => {
    const content = { foo: "bar" };
    const event = "core:storage:public:document:createOrReplace";

    beforeEach(() => {
      request.input.body = content;
      request.input.args._id = "foobar";

      answers[event] = {
        _id: "_id",
        _source: "_source",
        _version: "_version",
        created: true,
      };
    });

    it('should not notify with "silent" argument', async () => {
      request.input.args.silent = true;

      await controller.createOrReplace(request);

      expectNoNotification();
    });

    it("should forward to the store module and notify", async () => {
      request.context.user = invalid({ _id: "aschen" });
      request.input.args.refresh = "wait_for";

      await expect(controller.createOrReplace(request)).resolves.toMatchObject({
        _id: "_id",
        _source: "_source",
        _version: "_version",
        created: true,
      });

      expect(ask).toHaveBeenCalledWith(
        event,
        index,
        collection,
        "foobar",
        bodyWithMeta(content, replacedMeta("aschen")),
        { injectKuzzleMeta: false, refresh: "wait_for", userId: "aschen" },
      );

      expect(validate).toHaveBeenCalledWith(request, false);

      expect(ask).toHaveBeenCalledWith(
        "core:realtime:document:notify",
        request,
        actionEnum.WRITE,
        // `_version` and `created` too — both invisible to a partial match.
        {
          _id: "_id",
          _source: "_source",
          _version: "_version",
          created: true,
        },
      );
    });

    it("should have default value for refresh and userId", async () => {
      await controller.createOrReplace(request);

      expect(ask).toHaveBeenCalledWith(
        event,
        index,
        collection,
        "foobar",
        bodyWithMeta(content, replacedMeta(null)),
        { injectKuzzleMeta: false, refresh: "false", userId: null },
      );
    });
  });

  describe("#update", () => {
    const content = { foo: "bar" };
    const event = "core:storage:public:document:update";

    beforeEach(() => {
      request.input.body = { ...content };
      request.input.args._id = "foobar";

      answers[event] = {
        _id: "_id",
        _source: { ...content, name: "gordon" },
        _version: "_version",
      };
    });

    it('should not notify with "silent" argument', async () => {
      request.input.args.silent = true;

      await controller.update(request);

      expectNoNotification();
    });

    it("should forward to the store module and notify", async () => {
      request.context.user = invalid({ _id: "aschen" });
      request.input.args.refresh = "wait_for";
      request.input.args.retryOnConflict = 42;

      await expect(controller.update(request)).resolves.toMatchObject({
        _id: "_id",
        _source: content,
        _version: "_version",
      });

      expect(ask).toHaveBeenCalledWith(
        event,
        index,
        collection,
        "foobar",
        bodyWithMeta(content, updatedMeta("aschen")),
        {
          injectKuzzleMeta: false,
          refresh: "wait_for",
          retryOnConflict: 42,
          userId: "aschen",
        },
      );

      expect(validate).toHaveBeenCalledWith(request, false);

      expect(ask).toHaveBeenCalledWith(
        "core:realtime:document:notify",
        request,
        actionEnum.UPDATE,
        /* The notification carries the MERGED document — `name: "gordon"` is
         * the stored value, not something the request sent — and no
         * `_version`. The Mocha spec matched `_source: content` partially and
         * so said neither. */
        {
          _id: "_id",
          _source: { ...content, name: "gordon" },
          _updatedFields: ["foo"],
        },
      );
    });

    it("should have default value for refresh, userId and retryOnConflict", async () => {
      await controller.update(request);

      expect(ask).toHaveBeenCalledWith(
        event,
        index,
        collection,
        "foobar",
        bodyWithMeta(content, updatedMeta(null)),
        {
          injectKuzzleMeta: false,
          refresh: "false",
          retryOnConflict: undefined,
          userId: null,
        },
      );
    });

    it("should returns the entire document with source: true", async () => {
      request.input.args.source = true;

      await expect(controller.update(request)).resolves.toEqual({
        _id: "_id",
        _source: { ...content, name: "gordon" },
        _version: "_version",
      });
    });
  });

  describe("#upsert", () => {
    const changes = { foo: "bar" };
    const defaultValues = { def: "val" };
    const event = "core:storage:public:document:upsert";

    beforeEach(() => {
      request.input.body = { changes: { ...changes }, default: defaultValues };
      request.input.args._id = "foobar";

      answers[event] = {
        _id: "_id",
        _source: { ...changes, name: "gordon" },
        _version: "_version",
        created: false,
      };
    });

    it('should not notify with "silent" argument', async () => {
      request.input.args.silent = true;

      await controller.upsert(request);

      expectNoNotification();
    });

    it("should forward to the storage module and notify on update", async () => {
      request.context.user = invalid({ _id: "aschen" });
      request.input.args.refresh = "wait_for";
      request.input.args.retryOnConflict = 42;

      await expect(controller.upsert(request)).resolves.toMatchObject({
        _id: "_id",
        _version: "_version",
        created: false,
      });

      expect(ask).toHaveBeenCalledWith(
        event,
        index,
        collection,
        "foobar",
        bodyWithMeta(changes, updatedMeta("aschen")),
        {
          defaultValues: defaultsWithMeta(defaultValues, "aschen"),
          injectKuzzleMeta: false,
          refresh: "wait_for",
          retryOnConflict: 42,
          userId: "aschen",
        },
      );

      expect(ask).toHaveBeenCalledWith(
        "core:realtime:document:notify",
        request,
        actionEnum.UPDATE,
        {
          _id: "_id",
          _source: { ...changes, name: "gordon" },
          _updatedFields: ["foo"],
        },
      );
    });

    it("should forward to the storage module and notify on create", async () => {
      request.context.user = invalid({ _id: "aschen" });
      request.input.args.refresh = "wait_for";
      request.input.args.retryOnConflict = 42;

      answers[event] = {
        _id: "_id",
        _source: { ...defaultValues, ...changes, name: "gordon" },
        _version: "_version",
        created: true,
      };

      await expect(controller.upsert(request)).resolves.toMatchObject({
        _id: "_id",
        _version: "_version",
        created: true,
      });

      expect(ask).toHaveBeenCalledWith(
        event,
        index,
        collection,
        "foobar",
        bodyWithMeta(changes, updatedMeta("aschen")),
        {
          defaultValues: defaultsWithMeta(defaultValues, "aschen"),
          injectKuzzleMeta: false,
          refresh: "wait_for",
          retryOnConflict: 42,
          userId: "aschen",
        },
      );

      expect(ask).toHaveBeenCalledWith(
        "core:realtime:document:notify",
        request,
        actionEnum.CREATE,
        { ...defaultValues, ...changes, name: "gordon" },
      );
    });

    it("should have default value for refresh, userId and retryOnConflict", async () => {
      request.input.body.default = undefined;

      await controller.upsert(request);

      expect(ask).toHaveBeenCalledWith(
        event,
        index,
        collection,
        "foobar",
        bodyWithMeta(changes, updatedMeta(null)),
        {
          defaultValues: defaultsWithMeta({}),
          injectKuzzleMeta: false,
          refresh: "false",
          retryOnConflict: undefined,
          userId: null,
        },
      );
    });

    it("should return the entire document with source: true", async () => {
      request.input.args.source = true;

      await expect(controller.upsert(request)).resolves.toEqual({
        _id: "_id",
        _source: { ...changes, name: "gordon" },
        _version: "_version",
        created: false,
      });
    });
  });

  describe("#updateByQuery", () => {
    const event = "core:storage:public:document:updateByQuery";
    let esResponse: JSONObject;

    const withBody = () => {
      request.input.body = {
        changes: { bar: "foo" },
        query: { match: { foo: "bar" } },
      };
    };

    beforeEach(() => {
      esResponse = {
        errors: [],
        successes: [
          { _id: "id1", _source: { bar: "foo", foo: "bar" } },
          { _id: "id2", _source: { bar: "foo", foo: "bar" } },
        ],
      };

      answers[event] = esResponse;
    });

    it('should not notify with "silent" argument', async () => {
      withBody();
      request.input.args.silent = true;

      await controller.updateByQuery(request);

      expectNoNotification();
    });

    it("should forward to the store module and notify the changes", async () => {
      withBody();
      request.input.args.refresh = "wait_for";
      request.input.args.source = true;
      request.context.user = invalid({ _id: "aschen" });

      await expect(controller.updateByQuery(request)).resolves.toEqual(
        esResponse,
      );

      expect(ask).toHaveBeenCalledWith(
        event,
        index,
        collection,
        { match: { foo: "bar" } },
        { bar: "foo" },
        { refresh: "wait_for", userId: "aschen" },
      );

      expect(ask).toHaveBeenCalledWith(
        "core:realtime:document:mNotify",
        request,
        actionEnum.UPDATE,
        invalid<JSONObject[]>(esResponse.successes).map((doc) => ({
          _id: doc._id,
          _source: doc._source,
          _updatedFields: ["bar"],
        })),
      );
    });

    it("should not include documents content in the response of updateByQuery", async () => {
      withBody();
      request.input.args.refresh = "wait_for";
      request.input.args.source = false;

      await expect(controller.updateByQuery(request)).resolves.toEqual(
        esResponse,
      );

      expect(ask).toHaveBeenCalledWith(
        event,
        index,
        collection,
        { match: { foo: "bar" } },
        { bar: "foo" },
        { refresh: "wait_for", userId: null },
      );

      expect(ask).toHaveBeenCalledWith(
        "core:realtime:document:mNotify",
        request,
        actionEnum.UPDATE,
        invalid<JSONObject[]>(esResponse.successes).map((doc) => ({
          _id: doc._id,
          _source: { bar: "foo", foo: "bar" },
          _updatedFields: ["bar"],
        })),
      );
    });

    it('should reject if field "query" is missing', async () => {
      request.input.body = {
        changes: { bar: "foo" },
        invalidField: { match: { foo: "bar" } },
      };

      await rejects(controller.updateByQuery(request), {
        id: "api.assert.missing_argument",
        message: expect.stringMatching(
          /^Missing argument "body\.query"/,
        ) as unknown as string,
      });
    });

    it('should reject if field "changes" is missing', async () => {
      request.input.body = {
        invalidField: { bar: "foo" },
        query: { match: { foo: "bar" } },
      };

      await rejects(controller.updateByQuery(request), {
        id: "api.assert.missing_argument",
        message: expect.stringMatching(
          /^Missing argument "body\.changes"/,
        ) as unknown as string,
      });
    });

    it('should reject if the "lang" is not supported', async () => {
      request.input.body = {
        changes: {},
        query: { equals: { name: "Melis" } },
      };
      request.input.args.lang = "turkish";

      await rejects(controller.updateByQuery(request), {
        id: "api.assert.invalid_argument",
      });
    });

    it('should call the "translateKoncorde" method if "lang" is "koncorde"', async () => {
      request.input.body = {
        changes: {},
        query: { equals: { name: "Melis" } },
      };
      request.input.args.lang = "koncorde";

      const translate = vi
        .spyOn(internalsOf(controller), "translateKoncorde")
        .mockResolvedValue(undefined);

      await controller.updateByQuery(request);

      expect(translate).toHaveBeenCalledWith({ equals: { name: "Melis" } });
    });
  });

  describe("#replace", () => {
    const content = { foo: "bar" };
    const event = "core:storage:public:document:replace";

    beforeEach(() => {
      request.input.body = content;
      request.input.args._id = "foobar";

      answers[event] = {
        _id: "_id",
        _source: "_source",
        _version: "_version",
      };
    });

    it('should not notify with "silent" argument', async () => {
      request.input.args.silent = true;

      await controller.replace(request);

      expectNoNotification();
    });

    it("should forward to the store module and notify", async () => {
      request.context.user = invalid({ _id: "aschen" });
      request.input.args.refresh = "wait_for";

      await expect(controller.replace(request)).resolves.toMatchObject({
        _id: "_id",
        _source: "_source",
        _version: "_version",
      });

      expect(ask).toHaveBeenCalledWith(
        event,
        index,
        collection,
        "foobar",
        bodyWithMeta(content, replacedMeta("aschen")),
        { injectKuzzleMeta: false, refresh: "wait_for", userId: "aschen" },
      );

      expect(validate).toHaveBeenCalledWith(request, false);

      expect(ask).toHaveBeenCalledWith(
        "core:realtime:document:notify",
        request,
        actionEnum.REPLACE,
        { _id: "foobar", _source: content },
      );
    });

    it("should have default value for refresh and userId", async () => {
      await controller.replace(request);

      expect(ask).toHaveBeenCalledWith(
        event,
        index,
        collection,
        "foobar",
        bodyWithMeta(content, replacedMeta(null)),
        { injectKuzzleMeta: false, refresh: "false", userId: null },
      );
    });
  });

  describe("#delete", () => {
    beforeEach(() => {
      request.input.args._id = "foobar";

      answers["core:storage:public:document:get"] = {
        _id: "foobar",
        _source: "_source",
      };
    });

    it('should not notify with "silent" argument', async () => {
      request.input.args.silent = true;

      await controller.delete(request);

      expectNoNotification();
    });

    it("should forward to the store module and notify", async () => {
      request.input.args.refresh = "wait_for";

      await expect(controller.delete(request)).resolves.toEqual({
        _id: "foobar",
      });

      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:document:delete",
        index,
        collection,
        "foobar",
        { refresh: "wait_for" },
      );

      expect(ask).toHaveBeenCalledWith(
        "core:realtime:document:notify",
        request,
        actionEnum.DELETE,
        { _id: "foobar", _source: "_source" },
      );
    });

    it("should forward to the store module, notify and retrieve document source", async () => {
      request.input.args.source = true;

      await expect(controller.delete(request)).resolves.toEqual({
        _id: "foobar",
        _source: "_source",
      });

      expect(ask).toHaveBeenCalledWith(
        "core:realtime:document:notify",
        request,
        actionEnum.DELETE,
        { _id: "foobar", _source: "_source" },
      );
    });
  });

  describe("#deleteFields", () => {
    const content = { fields: ["garbage"] };
    const event = "core:storage:public:document:deleteFields";

    beforeEach(() => {
      request.input.body = content;
      request.input.args._id = "foobar";

      answers[event] = {
        _id: "_id",
        _source: { foo: "bar" },
        _version: "_version",
      };
    });

    it('should not notify with "silent" argument', async () => {
      request.input.args.silent = true;

      await controller.deleteFields(request);

      expectNoNotification();
    });

    it("should forward to the store module and notify", async () => {
      request.context.user = invalid({ _id: "aschen" });
      request.input.args.refresh = "wait_for";

      await expect(controller.deleteFields(request)).resolves.toMatchObject({
        _id: "_id",
        _version: "_version",
      });

      expect(ask).toHaveBeenCalledWith(
        event,
        index,
        collection,
        "foobar",
        content.fields,
        { refresh: "wait_for", userId: "aschen" },
      );

      expect(ask).toHaveBeenCalledWith(
        "core:realtime:document:notify",
        request,
        actionEnum.UPDATE,
        { _id: "_id", _source: { foo: "bar" } },
      );
    });

    it("should have default value for refresh, userId", async () => {
      await controller.deleteFields(request);

      expect(ask).toHaveBeenCalledWith(
        event,
        index,
        collection,
        "foobar",
        content.fields,
        { refresh: "false", userId: null },
      );
    });

    it("should return the entire document with source: true", async () => {
      request.input.args.source = true;

      await expect(controller.deleteFields(request)).resolves.toEqual({
        _id: "_id",
        _source: { foo: "bar" },
        _version: "_version",
      });
    });
  });

  describe("#mDelete", () => {
    const event = "core:storage:public:document:mDelete";
    const ids = ["id1", "id2", "id3"];
    const documents = [
      { _id: "id1", _source: "_source1" },
      { _id: "id2", _source: "_source2" },
      { _id: "id3", _source: "_source3" },
    ];

    beforeEach(() => {
      request.input.body = { ids };

      answers[event] = { documents, errors: [] };
    });

    it('should not notify with "silent" argument', async () => {
      request.input.args.silent = true;

      await controller.mDelete(request);

      expectNoNotification();
    });

    it("should forward to the store module and notify the changes", async () => {
      request.input.args.refresh = "wait_for";

      await expect(controller.mDelete(request)).resolves.toMatchObject({
        errors: [],
        successes: ids,
      });

      expect(ask).toHaveBeenCalledWith(event, index, collection, ids, {
        refresh: "wait_for",
      });

      expect(ask).toHaveBeenCalledWith(
        "core:realtime:document:mNotify",
        request,
        actionEnum.DELETE,
        documents,
      );
    });

    it("should handle errors if some actions failed", async () => {
      const errors = [{ id: "id1", reason: "reason" }];

      answers[event] = { documents, errors };

      await expect(controller.mDelete(request)).resolves.toMatchObject({
        errors,
        successes: ids,
      });
    });

    it("should throw an error in strict mode if at least one deletion has failed", async () => {
      // The Mocha spec neither returned nor awaited this one.
      request.input.args.strict = true;
      answers[event] = {
        documents,
        errors: [{ id: "id1", reason: "reason" }],
      };

      await rejects(
        controller.mDelete(request),
        { id: "api.process.incomplete_multiple_request" },
        MultipleErrorsError,
      );
    });
  });

  describe("#deleteByQuery", () => {
    const event = "core:storage:public:document:deleteByQuery";

    beforeEach(() => {
      answers[event] = {
        deleted: 2,
        documents: [
          { _id: "id1", _source: "_source1" },
          { _id: "id2", _source: "_source2" },
        ],
        failures: [],
        total: 2,
      };
    });

    it('should not notify with "silent" argument', async () => {
      request.input.args.silent = true;

      await controller.deleteByQuery(request);

      expectNoNotification();
    });

    it("should forward to the store module and notify the changes", async () => {
      request.input.body = { query: { foo: "bar" } };
      request.input.args.refresh = "wait_for";

      await expect(controller.deleteByQuery(request)).resolves.toMatchObject({
        documents: [
          { _id: "id1", _source: undefined },
          { _id: "id2", _source: undefined },
        ],
      });

      expect(ask).toHaveBeenCalledWith(
        event,
        index,
        collection,
        { foo: "bar" },
        { refresh: "wait_for" },
      );

      expect(ask).toHaveBeenCalledWith(
        "core:realtime:document:mNotify",
        request,
        actionEnum.DELETE,
        [
          { _id: "id1", _source: undefined },
          { _id: "id2", _source: undefined },
        ],
      );
    });

    it("should forward to the store module, notify the changes and retrieve all sources", async () => {
      request.input.body = { query: { foo: "bar" } };
      request.input.args.refresh = "wait_for";
      request.input.args.source = true;

      await expect(controller.deleteByQuery(request)).resolves.toMatchObject({
        documents: [
          { _id: "id1", _source: "_source1" },
          { _id: "id2", _source: "_source2" },
        ],
      });

      expect(ask).toHaveBeenCalledWith(
        "core:realtime:document:mNotify",
        request,
        actionEnum.DELETE,
        [
          { _id: "id1", _source: "_source1" },
          { _id: "id2", _source: "_source2" },
        ],
      );
    });

    it('should reject if the "lang" is not supported', async () => {
      request.input.body = { query: { foo: "bar" } };
      request.input.args.lang = "turkish";

      await rejects(controller.deleteByQuery(request), {
        id: "api.assert.invalid_argument",
      });
    });

    it('should call the "translateKoncorde" method if "lang" is "koncorde"', async () => {
      request.input.body = { query: { equals: { name: "Melis" } } };
      request.input.args.lang = "koncorde";

      const translate = vi
        .spyOn(internalsOf(controller), "translateKoncorde")
        .mockResolvedValue(undefined);

      await controller.deleteByQuery(request);

      expect(translate).toHaveBeenCalledWith({ equals: { name: "Melis" } });
    });
  });

  describe("#validate", () => {
    it("should call validation.validate method", async () => {
      request.input.body = { foo: "bar" };
      validate.mockResolvedValue({ ok: "ok" });

      await expect(controller.validate(request)).resolves.toMatchObject({
        ok: "ok",
      });

      expect(validate).toHaveBeenCalledWith(request, true);
    });
  });
});
