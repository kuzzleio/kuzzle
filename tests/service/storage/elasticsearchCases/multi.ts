/**
 * L5e (1/2) — the `m*` family: `mGet`, `mExists`, `mCreate`,
 * `mCreateOrReplace`, `mUpdate`, `mUpsert`, `mReplace`, `mDelete`, and the
 * `_extractMDocuments` they all go through.
 *
 * Every one of these actions is the same three steps: turn the caller's
 * documents into a bulk request, set aside the ones that cannot be written,
 * and hand both to `_mExecute` — which `queries.ts` (L5c) covers on its own.
 * So `_mExecute` is spied here, and what each case states is the **translation
 * either side of it**: which documents become which bulk operations, which are
 * rejected and why, and what the result looks like once the client has
 * answered.
 *
 * The twins asserted all of it with `calledWithMatch`. These cases assert the
 * whole call, so the `_kuzzle_info` each action stamps — three different
 * shapes across the eight — is stated rather than sampled.
 */
import { describe, expect, it, vi } from "vitest";

import type { ESHarness } from "./harness";

const index = "nyc-open-data";
const collection = "yellow-taxi";
const alias = "@&nyc-open-data.yellow-taxi";

export function describeMulti(harness: ESHarness) {
  /** What a freshly written document is stamped with. */
  const createMeta = (author: string | null = null) => ({
    _kuzzle_info: {
      author,
      createdAt: harness.timestamp,
      updatedAt: null,
      updater: null,
    },
  });

  /** What an updated one is stamped with: the other half, alone. */
  const updateMeta = (updater: string | null = null) => ({
    _kuzzle_info: { updatedAt: harness.timestamp, updater },
  });

  const defaultRetries = () => harness.config.defaults.onUpdateConflictRetries;

  /** Spies `_mExecute`, which L5c covers, and answers what it will resolve. */
  const stubExecute = (result: unknown = { items: [], errors: [] }) =>
    vi.spyOn(harness.client, "_mExecute").mockResolvedValue(result);

  /** The three arguments `_mExecute` was handed. */
  const executed = () => {
    expect(harness.client._mExecute).toHaveBeenCalledTimes(1);

    const [esRequest, toImport, rejected, options] =
      harness.client._mExecute.mock.calls[0];

    return { esRequest, toImport, rejected, options };
  };

  /** A bulk request, with its operation list under whichever key applies. */
  const bulk = (operations: unknown[], rest: Record<string, unknown> = {}) => ({
    index: alias,
    refresh: undefined,
    timeout: undefined,
    ...rest,
    [harness.envelope.bulkOperations]: operations,
  });

  const armMget = (docs: unknown[]) =>
    harness.clientStub.mget.mockResolvedValue(
      harness.envelope.respond({ docs }),
    );

  describe("#mGet", () => {
    it("fetches several documents at once and splits found from missing", async () => {
      armMget([
        {
          _id: "liia",
          found: true,
          _source: { city: "Kathmandu" },
          _version: 1,
        },
        { _id: "mhery", found: false },
      ]);

      expect(
        await harness.client.mGet(index, collection, ["liia", "mhery"]),
      ).toEqual({
        items: [{ _id: "liia", _source: { city: "Kathmandu" }, _version: 1 }],
        errors: ["mhery"],
      });

      expect(harness.sent(harness.clientStub.mget)).toMatchObject(
        harness.envelope.request({
          docs: [
            { _id: "liia", _index: alias },
            { _id: "mhery", _index: alias },
          ],
        }),
      );
    });

    it("answers an empty result without asking the client at all", async () => {
      expect(await harness.client.mGet(index, collection, [])).toEqual({
        errors: [],
        items: [],
      });

      expect(harness.clientStub.mget).not.toHaveBeenCalled();
    });

    it("rejects through the wrapper when the client fails", async () => {
      harness.clientStub.mget.mockRejectedValue(harness.esClientError);

      await expect(
        harness.client.mGet(index, collection, ["liia"]),
      ).rejects.toBe(harness.esClientError);

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#mExists", () => {
    /* Same request as `mGet` minus the source, and ids for an answer. */
    it("answers which of the ids exist, by id alone", async () => {
      armMget([
        { _id: "foo", found: true },
        { _id: "bar", found: false },
      ]);

      expect(
        await harness.client.mExists(index, collection, ["foo", "bar"]),
      ).toEqual({ items: ["foo"], errors: ["bar"] });

      expect(harness.sent(harness.clientStub.mget)).toMatchObject({
        index: alias,
        ...harness.envelope.request({
          docs: [{ _id: "foo" }, { _id: "bar" }],
        }),
      });
    });

    it("answers an empty result without asking the client at all", async () => {
      expect(await harness.client.mExists(index, collection, [])).toEqual({
        errors: [],
        items: [],
      });

      expect(harness.clientStub.mget).not.toHaveBeenCalled();
    });

    it("rejects through the wrapper when the client fails", async () => {
      harness.clientStub.mget.mockRejectedValue(harness.esClientError);

      await expect(
        harness.client.mExists(index, collection, ["foo"]),
      ).rejects.toBe(harness.esClientError);

      expect(harness.esWrapper.formatESError).toHaveBeenCalledWith(
        harness.esClientError,
      );
    });
  });

  describe("#mCreate", () => {
    const withIds = () => [
      { body: { city: "Kathmandu" } },
      { _id: "liia", body: { city: "Ho Chi Minh City" } },
    ];

    const withoutIds = () => [
      { body: { city: "Kathmandu" } },
      { body: { city: "Ho Chi Minh City" } },
    ];

    /*
     * Creating means refusing to overwrite, so any document that named an id
     * has to be checked first — and only those. A batch where Elasticsearch
     * allocates every id needs no check at all.
     */
    it("checks the ids the caller named, and only those", async () => {
      stubExecute();
      armMget([]);

      await harness.client.mCreate(index, collection, withIds());

      expect(harness.sent(harness.clientStub.mget)).toMatchObject({
        index: alias,
        ...harness.envelope.request({
          docs: [{ _id: "liia", _source: false }],
        }),
      });

      const { esRequest, toImport, rejected } = executed();

      /* ⚠️ No `_id` on either operation: `mCreate` never sends one, so even
       * the document that named `liia` is written under an id Elasticsearch
       * allocates. The check above only decides whether to write it at all. */
      expect(esRequest).toEqual(
        bulk([
          { index: { _index: alias } },
          { city: "Kathmandu", ...createMeta() },
          { index: { _index: alias } },
          { city: "Ho Chi Minh City", ...createMeta() },
        ]),
      );
      expect(toImport).toMatchObject([
        { _source: { city: "Kathmandu", ...createMeta() } },
        { _id: "liia", _source: { city: "Ho Chi Minh City", ...createMeta() } },
      ]);
      expect(rejected).toEqual([]);
    });

    it("sets aside a document whose id is already taken", async () => {
      stubExecute();
      armMget([{ _id: "liia", found: true }]);

      await harness.client.mCreate(index, collection, withIds());

      const { esRequest, toImport, rejected } = executed();

      expect(esRequest).toEqual(
        bulk([
          { index: { _index: alias } },
          { city: "Kathmandu", ...createMeta() },
        ]),
      );
      expect(toImport).toMatchObject([
        { _source: { city: "Kathmandu", ...createMeta() } },
      ]);
      expect(rejected).toMatchObject([
        {
          document: {
            _id: "liia",
            body: { _kuzzle_info: undefined, city: "Ho Chi Minh City" },
          },
          reason: "document already exists",
          status: 400,
        },
      ]);
    });

    it("skips the check entirely when no document named an id", async () => {
      stubExecute();

      await harness.client.mCreate(index, collection, withoutIds());

      expect(harness.clientStub.mget).not.toHaveBeenCalled();
      expect(executed().rejected).toEqual([]);
    });

    it("carries refresh, timeout and the user who asked", async () => {
      stubExecute();

      await harness.client.mCreate(index, collection, withoutIds(), {
        refresh: "wait_for",
        timeout: "10m",
        userId: "aschen",
      });

      expect(executed().esRequest).toEqual(
        bulk(
          [
            { index: { _index: alias } },
            { city: "Kathmandu", ...createMeta("aschen") },
            { index: { _index: alias } },
            { city: "Ho Chi Minh City", ...createMeta("aschen") },
          ],
          { refresh: "wait_for", timeout: "10m" },
        ),
      );
    });
  });

  describe("#mCreateOrReplace", () => {
    const documents = () => [
      { _id: "mehry", body: { city: "Kathmandu" } },
      { _id: "liia", body: { city: "Ho Chi Minh City" } },
    ];

    /*
     * No existence check here, and the ids **are** sent: overwriting is the
     * point, so there is nothing to find out first.
     */
    it("writes every document under its own id, stamped as a creation", async () => {
      stubExecute();

      await harness.client.mCreateOrReplace(index, collection, documents());

      expect(harness.clientStub.mget).not.toHaveBeenCalled();

      const { esRequest, toImport, rejected } = executed();

      expect(esRequest).toEqual(
        bulk([
          { index: { _index: alias, _id: "mehry" } },
          { city: "Kathmandu", ...createMeta() },
          { index: { _index: alias, _id: "liia" } },
          { city: "Ho Chi Minh City", ...createMeta() },
        ]),
      );
      expect(toImport).toMatchObject([
        { _id: "mehry", _source: { city: "Kathmandu", ...createMeta() } },
        { _id: "liia", _source: { city: "Ho Chi Minh City", ...createMeta() } },
      ]);
      expect(rejected).toEqual([]);
    });

    it("carries refresh, timeout and the user who asked", async () => {
      stubExecute();

      await harness.client.mCreateOrReplace(index, collection, documents(), {
        refresh: "wait_for",
        timeout: "10m",
        userId: "aschen",
      });

      expect(executed().esRequest).toMatchObject({
        refresh: "wait_for",
        timeout: "10m",
        [harness.envelope.bulkOperations]: [
          { index: { _index: alias, _id: "mehry" } },
          { city: "Kathmandu", ...createMeta("aschen") },
          { index: { _index: alias, _id: "liia" } },
          { city: "Ho Chi Minh City", ...createMeta("aschen") },
        ],
      });
    });

    /* The one caller that asks for this is the bulk controller's `import`. */
    it("writes the documents untouched when told not to stamp them", async () => {
      stubExecute();

      await harness.client.mCreateOrReplace(index, collection, documents(), {
        injectKuzzleMeta: false,
      });

      const { esRequest, toImport } = executed();

      expect(esRequest).toEqual(
        bulk([
          { index: { _index: alias, _id: "mehry" } },
          { city: "Kathmandu" },
          { index: { _index: alias, _id: "liia" } },
          { city: "Ho Chi Minh City" },
        ]),
      );
      expect(toImport).toMatchObject([
        { _id: "mehry", _source: { city: "Kathmandu" } },
        { _id: "liia", _source: { city: "Ho Chi Minh City" } },
      ]);
    });

    it("forwards `source` and `limits` to the executor", async () => {
      stubExecute();

      await harness.client.mCreateOrReplace(index, collection, documents(), {
        source: false,
        limits: false,
      });

      expect(executed().options).toMatchObject({
        source: false,
        limits: false,
      });
    });
  });

  describe("#mUpdate", () => {
    const documents = () => [
      { _id: "mehry", body: { city: "Kathmandu" } },
      { _id: "liia", body: { city: "Ho Chi Minh City" } },
    ];

    /** What `_mExecute` answers: the partial write, plus ES's `get`. */
    const updated = () => ({
      items: [
        {
          _id: "mehry",
          _source: { city: "Kathmandu" },
          get: { _source: { age: 26, city: "Kathmandu" } },
        },
        {
          _id: "liia",
          _source: { city: "Ho Chi Minh City" },
          get: { _source: { age: 29, city: "Ho Chi Minh City" } },
        },
      ],
      errors: [],
    });

    /*
     * `_source: true` on each operation is what makes this possible: the
     * caller sent a *partial* document, and what it gets back is the whole
     * one, read off the `get` Elasticsearch attaches to each answered row.
     */
    it("sends partial updates and answers the whole documents", async () => {
      stubExecute(updated());

      const result = await harness.client.mUpdate(
        index,
        collection,
        documents(),
      );

      const { esRequest, toImport, rejected } = executed();

      expect(esRequest).toEqual(
        bulk([
          {
            update: {
              _index: alias,
              _id: "mehry",
              retry_on_conflict: defaultRetries(),
            },
          },
          { doc: { city: "Kathmandu", ...updateMeta() }, _source: true },
          {
            update: {
              _index: alias,
              _id: "liia",
              retry_on_conflict: defaultRetries(),
            },
          },
          {
            doc: { city: "Ho Chi Minh City", ...updateMeta() },
            _source: true,
          },
        ]),
      );
      expect(toImport).toMatchObject([
        { _id: "mehry", _source: { city: "Kathmandu", ...updateMeta() } },
        { _id: "liia", _source: { city: "Ho Chi Minh City", ...updateMeta() } },
      ]);
      expect(rejected).toEqual([]);

      expect(result).toMatchObject({
        items: [
          { _id: "mehry", _source: { city: "Kathmandu", age: 26 } },
          { _id: "liia", _source: { city: "Ho Chi Minh City", age: 29 } },
        ],
        errors: [],
      });
    });

    it("carries refresh, timeout, the user and the retry count", async () => {
      stubExecute(updated());

      await harness.client.mUpdate(index, collection, documents(), {
        refresh: "wait_for",
        retryOnConflict: 2,
        timeout: "10m",
        userId: "aschen",
      });

      expect(executed().esRequest).toMatchObject({
        refresh: "wait_for",
        timeout: "10m",
        [harness.envelope.bulkOperations]: [
          { update: { _index: alias, _id: "mehry", retry_on_conflict: 2 } },
          {
            doc: { city: "Kathmandu", ...updateMeta("aschen") },
            _source: true,
          },
          { update: { _index: alias, _id: "liia", retry_on_conflict: 2 } },
          {
            doc: { city: "Ho Chi Minh City", ...updateMeta("aschen") },
            _source: true,
          },
        ],
      });
    });

    /* There is nothing to update without an id, and it is not an error. */
    it("sets aside a document that named no id", async () => {
      stubExecute(updated());

      await harness.client.mUpdate(index, collection, [
        { _id: "mehry", body: { city: "Kathmandu" } },
        { body: { city: "Ho Chi Minh City" } },
      ]);

      const { toImport, rejected } = executed();

      expect(toImport).toMatchObject([
        { _id: "mehry", _source: { city: "Kathmandu", ...updateMeta() } },
      ]);
      expect(rejected).toMatchObject([
        {
          document: {
            _id: undefined,
            body: { _kuzzle_info: undefined, city: "Ho Chi Minh City" },
          },
          reason: "document _id must be a string",
          status: 400,
        },
      ]);
    });
  });

  describe("#mUpsert", () => {
    const documents = (): Record<string, unknown>[] => [
      { _id: "mehry", changes: { city: "Kathmandu" } },
      { _id: "liia", changes: { city: "Ho Chi Minh City" } },
    ];

    /** The two branches of an upsert, stamped differently on purpose. */
    const operations = (retries = defaultRetries()) => [
      {
        update: {
          _index: alias,
          _id: "mehry",
          _source: true,
          retry_on_conflict: retries,
        },
      },
      {
        doc: { city: "Kathmandu", ...updateMeta() },
        upsert: {
          city: "Kathmandu",
          _kuzzle_info: { author: null, createdAt: harness.timestamp },
        },
      },
      {
        update: {
          _index: alias,
          _id: "liia",
          _source: true,
          retry_on_conflict: retries,
        },
      },
      {
        doc: { city: "Ho Chi Minh City", ...updateMeta() },
        upsert: {
          city: "Ho Chi Minh City",
          _kuzzle_info: { author: null, createdAt: harness.timestamp },
        },
      },
    ];

    const answered = (secondResult = "updated") => ({
      items: [
        {
          _id: "mehry",
          _source: { city: "Kathmandu" },
          created: false,
          result: "updated",
          get: { _source: { age: 26, city: "Kathmandu" } },
        },
        {
          _id: "liia",
          _source: { city: "Ho Chi Minh City" },
          created: false,
          result: secondResult,
          get: { _source: { age: 29, city: "Ho Chi Minh City" } },
        },
      ],
      errors: [],
    });

    /*
     * ⚠️ The update half is stamped `updatedAt`/`updater`; the creation half
     * `author`/`createdAt`. A document that already exists therefore never
     * gets an author from an upsert, and one created by it never gets an
     * update stamp — two different stamps in one operation.
     */
    it("stamps the update branch and the creation branch differently", async () => {
      stubExecute(answered());

      const result = await harness.client.mUpsert(
        index,
        collection,
        documents(),
      );

      const { esRequest, toImport, rejected } = executed();

      expect(esRequest).toMatchObject({
        refresh: undefined,
        timeout: undefined,
        [harness.envelope.bulkOperations]: operations(),
      });
      /* Both branches travel to the executor, per document. */
      expect(toImport).toMatchObject([
        {
          _id: "mehry",
          _source: {
            changes: { city: "Kathmandu", ...updateMeta() },
            default: {
              city: "Kathmandu",
              _kuzzle_info: { author: null, createdAt: harness.timestamp },
            },
          },
        },
        {
          _id: "liia",
          _source: {
            changes: { city: "Ho Chi Minh City", ...updateMeta() },
            default: {
              city: "Ho Chi Minh City",
              _kuzzle_info: { author: null, createdAt: harness.timestamp },
            },
          },
        },
      ]);
      expect(rejected).toEqual([]);

      expect(result).toMatchObject({
        items: [
          {
            _id: "mehry",
            _source: { city: "Kathmandu", age: 26 },
            created: false,
          },
          {
            _id: "liia",
            _source: { city: "Ho Chi Minh City", age: 29 },
            created: false,
          },
        ],
        errors: [],
      });
    });

    /* `created` is read off the row's `result`, not off what was asked. */
    it("reports which documents the upsert ended up creating", async () => {
      stubExecute(answered("created"));

      const result = await harness.client.mUpsert(
        index,
        collection,
        documents(),
      );

      expect(result.items.map((item: any) => item.created)).toEqual([
        false,
        true,
      ]);
    });

    it("adds a caller's default values to the creation branch only", async () => {
      stubExecute(answered());

      const documentsWithDefault = documents();

      documentsWithDefault[1].default = { country: "Vietnam" };

      await harness.client.mUpsert(index, collection, documentsWithDefault);

      const sent = executed().esRequest[harness.envelope.bulkOperations];

      expect(sent[3].upsert).toMatchObject({ country: "Vietnam" });
      expect(sent[3].doc).not.toHaveProperty("country");
    });

    it("carries refresh, timeout, the user and the retry count", async () => {
      stubExecute(answered());

      await harness.client.mUpsert(index, collection, documents(), {
        refresh: "wait_for",
        retryOnConflict: 42,
        timeout: "10m",
        userId: "aschen",
      });

      const esRequest = executed().esRequest;

      expect(esRequest).toMatchObject({ refresh: "wait_for", timeout: "10m" });
      expect(
        esRequest[harness.envelope.bulkOperations][0].update.retry_on_conflict,
      ).toBe(42);
    });

    it("sets aside a document that named no id", async () => {
      stubExecute(answered());

      await harness.client.mUpsert(index, collection, [
        { _id: "mehry", changes: { city: "Kathmandu" } },
        { changes: { city: "Ho Chi Minh City" } },
      ]);

      const { esRequest, rejected } = executed();

      expect(esRequest[harness.envelope.bulkOperations]).toHaveLength(2);
      expect(rejected).toMatchObject([
        {
          document: { changes: { city: "Ho Chi Minh City" } },
          reason: "document _id must be a string",
          status: 400,
        },
      ]);
    });
  });

  describe("#mReplace", () => {
    const documents = () => [
      { _id: "mehry", body: { city: "Kathmandu" } },
      { _id: "liia", body: { city: "Ho Chi Minh City" } },
    ];

    /*
     * Replacing refuses to *create*, so — the mirror of `mCreate` — every
     * document has to be found first, and the ids are sent.
     */
    it("checks that every document exists, then overwrites them", async () => {
      stubExecute();
      armMget([
        { _id: "mehry", found: true },
        { _id: "liia", found: true },
      ]);

      await harness.client.mReplace(index, collection, documents());

      expect(harness.sent(harness.clientStub.mget)).toMatchObject({
        index: alias,
        ...harness.envelope.request({
          docs: [
            { _id: "mehry", _source: false },
            { _id: "liia", _source: false },
          ],
        }),
      });

      const { esRequest, toImport, rejected } = executed();

      expect(esRequest).toMatchObject({
        [harness.envelope.bulkOperations]: [
          { index: { _id: "mehry", _index: alias } },
          { city: "Kathmandu", ...createMeta() },
          { index: { _id: "liia", _index: alias } },
          { city: "Ho Chi Minh City", ...createMeta() },
        ],
      });
      expect(toImport).toMatchObject([
        { _id: "mehry", _source: { city: "Kathmandu", ...createMeta() } },
        { _id: "liia", _source: { city: "Ho Chi Minh City", ...createMeta() } },
      ]);
      expect(rejected).toEqual([]);
    });

    it("sets aside a document that is not there", async () => {
      stubExecute();
      armMget([
        { _id: "mehry", found: true },
        { _id: "liia", found: false },
      ]);

      await harness.client.mReplace(index, collection, documents());

      const { toImport, rejected } = executed();

      expect(toImport).toMatchObject([
        { _id: "mehry", _source: { city: "Kathmandu", ...createMeta() } },
      ]);
      expect(rejected).toMatchObject([
        {
          document: {
            _id: "liia",
            body: { _kuzzle_info: undefined, city: "Ho Chi Minh City" },
          },
          reason: "document not found",
          status: 404,
        },
      ]);
    });

    /*
     * An answer with fewer rows than the request has documents. Treated as
     * "not found" for the documents the answer does not reach, rather than
     * read past its end.
     */
    it("sets aside a document the answer is too short to cover", async () => {
      stubExecute();
      armMget([{ _id: "mehry", found: true }]);

      await harness.client.mReplace(index, collection, documents());

      expect(executed().rejected).toMatchObject([
        {
          document: { _id: "liia" },
          reason: "document not found",
          status: 404,
        },
      ]);
    });

    it("sets aside a document that named no id, without asking about it", async () => {
      stubExecute();
      armMget([{ _id: "mehry", found: true }]);

      await harness.client.mReplace(index, collection, [
        { _id: "mehry", body: { city: "Kathmandu" } },
        { body: { city: "Ho Chi Minh City" } },
      ]);

      expect(harness.sent(harness.clientStub.mget)).toMatchObject(
        harness.envelope.request({ docs: [{ _id: "mehry", _source: false }] }),
      );

      expect(executed().rejected).toMatchObject([
        {
          document: { body: { city: "Ho Chi Minh City" } },
          reason: "document _id must be a string",
          status: 400,
        },
      ]);
    });

    it("carries refresh, timeout and the user who asked", async () => {
      stubExecute();
      armMget([
        { _id: "mehry", found: true },
        { _id: "liia", found: true },
      ]);

      await harness.client.mReplace(index, collection, documents(), {
        refresh: "wait_for",
        timeout: "10m",
        userId: "aschen",
      });

      expect(executed().esRequest).toMatchObject({
        refresh: "wait_for",
        timeout: "10m",
        [harness.envelope.bulkOperations]: [
          { index: { _id: "mehry", _index: alias } },
          { city: "Kathmandu", ...createMeta("aschen") },
          { index: { _id: "liia", _index: alias } },
          { city: "Ho Chi Minh City", ...createMeta("aschen") },
        ],
      });
    });
  });

  describe("#mDelete", () => {
    const mehry = { _id: "mehry", _source: { city: "Kathmandu" } };
    const liia = { _id: "liia", _source: { city: "Ho Chi Minh City" } };

    /*
     * ⚠️ `documents` in the answer comes from the **delete's own** fetch, not
     * from the `mGet` above it — the subject reads the collection twice, and
     * its own `@todo` says so. So this arms what the delete query finds, and
     * the cases below can differ from what `mGet` answered.
     */
    const armDelete = (found: unknown[] = [mehry, liia]) => {
      vi.spyOn(harness.client, "_getAllDocumentsFromQuery").mockResolvedValue(
        found,
      );

      harness.clientStub.deleteByQuery.mockResolvedValue(
        harness.envelope.respond({ total: 2, deleted: 2, failures: [] }),
      );

      harness.clientStub.indices.refresh.mockResolvedValue(
        harness.envelope.respond({ _shards: 1 }),
      );
    };

    const armFound = (items: unknown[]) =>
      vi.spyOn(harness.client, "mGet").mockResolvedValue({ items });

    /*
     * There is no bulk delete-by-id: the ids become one `ids` query, and the
     * documents are fetched first so the caller gets back what it deleted.
     */
    it("deletes several documents as one query, and answers them", async () => {
      armDelete();
      armFound([mehry, liia]);

      const result = await harness.client.mDelete(index, collection, [
        "mehry",
        "liia",
      ]);

      expect(harness.client.mGet).toHaveBeenCalledWith(index, collection, [
        "mehry",
        "liia",
      ]);

      expect(harness.sent(harness.clientStub.deleteByQuery)).toMatchObject({
        index: alias,
        scroll: "5s",
        ...harness.envelope.request({
          query: { ids: { values: ["mehry", "liia"] } },
        }),
      });

      /* The collection is refreshed so the deletion is immediately visible. */
      expect(harness.clientStub.indices.refresh).toHaveBeenCalledWith({
        index: alias,
      });

      expect(result).toEqual({ documents: [mehry, liia], errors: [] });
    });

    it("deletes what it found and reports what it did not", async () => {
      armDelete([mehry]);
      armFound([mehry]);

      const result = await harness.client.mDelete(index, collection, [
        "mehry",
        "liia",
      ]);

      expect(harness.sent(harness.clientStub.deleteByQuery)).toMatchObject(
        harness.envelope.request({ query: { ids: { values: ["mehry"] } } }),
      );

      expect(result).toEqual({
        documents: [mehry],
        errors: [{ _id: "liia", reason: "document not found", status: 404 }],
      });
    });

    /* An id that is not a string is refused before anything is asked. */
    it("refuses an id that is not a string, without asking about it", async () => {
      armDelete([mehry]);
      armFound([mehry]);

      const result = await harness.client.mDelete(index, collection, [
        "mehry",
        42,
      ]);

      expect(harness.client.mGet).toHaveBeenCalledWith(index, collection, [
        "mehry",
      ]);

      expect(result).toMatchObject({
        errors: [
          { _id: 42, reason: "document _id must be a string", status: 400 },
        ],
      });
    });

    it("carries refresh", async () => {
      armDelete();
      armFound([mehry, liia]);

      await harness.client.mDelete(index, collection, ["mehry", "liia"], {
        refresh: "wait_for",
      });

      expect(harness.sent(harness.clientStub.deleteByQuery)).toMatchObject({
        refresh: true,
      });
    });
  });

  describe("#_extractMDocuments", () => {
    /*
     * The one rule every `m*` action shares, and the only one this helper
     * enforces on its own: a document without a body cannot be written.
     */
    it("sets aside a document that carries no body", () => {
      const { rejected, extractedDocuments } =
        harness.client._extractMDocuments(
          [{ _id: "liia", body: { city: "Kathmandu" } }, { _id: "no-body" }],
          createMeta(),
        );

      expect(rejected).toMatchObject([
        {
          document: { _id: "no-body" },
          reason: "document body must be an object",
        },
      ]);

      expect(extractedDocuments).toMatchObject([
        { _id: "liia", _source: { city: "Kathmandu" } },
      ]);
    });
  });
}
