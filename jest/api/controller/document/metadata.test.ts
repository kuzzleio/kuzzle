import { Kuzzle, WebSocket } from "kuzzle-sdk";

const kuzzle = new Kuzzle(new WebSocket("localhost"));
const index = "computer";
const collection = "macbook";

beforeAll(async () => {
  await kuzzle.connect();
  if (await kuzzle.index.exists(index)) {
    await kuzzle.index.delete(index);
  }

  await kuzzle.index.create(index);
  await kuzzle.collection.create(index, collection, {});
});

afterAll(async () => {
  await kuzzle.index.delete(index);
  kuzzle.disconnect();
});

describe("document:create", () => {
  test("It should add metadata when creating a document", async () => {
    const response = await kuzzle.document.create(
      index,
      collection,
      { foo: "bar" },
      undefined,
      { refresh: "wait_for" },
    );

    // @ts-ignore
    expect(response._source._kuzzle_info).toBeDefined();
    // @ts-ignore
    expect(response._source._kuzzle_info).toEqual(
      expect.not.objectContaining({
        customMetadata: "customized",
      }),
    );
  });

  test("It should not let user add their own metadata when creating a document", async () => {
    const response = await kuzzle.document.create(
      index,
      collection,
      {
        foo: "bar",
        _kuzzle_info: {
          author: "foo",
          createdAt: 42,
          updatedAt: null,
          updater: null,
        },
      },
      undefined,
      { refresh: "wait_for" },
    );

    expect(response._source._kuzzle_info).toEqual(
      expect.not.objectContaining({
        author: "foo",
        createdAt: 42,
        updatedAt: null,
        updater: null,
      }),
    );
  });

  test("It should add custom metadata using the pipe", async () => {
    const response = await kuzzle.document.create(
      index,
      collection,
      { foo: "bar", addCustomMetadata: true },
      undefined,
      { refresh: "wait_for" },
    );

    // @ts-ignore
    expect(response._source._kuzzle_info).toEqual(
      expect.objectContaining({
        customMetadata: "customized",
      }),
    );
  });
});

describe("document:createOrReplace", () => {
  test("It should add metadata when creating or replacing a document", async () => {
    const response = await kuzzle.document.createOrReplace(
      index,
      collection,
      "test",
      { foo: "bar" },
      { refresh: "wait_for" },
    );

    // @ts-ignore
    expect(response._source._kuzzle_info).toBeDefined();
    // @ts-ignore
    expect(response._source._kuzzle_info).toEqual(
      expect.not.objectContaining({
        customMetadata: "customized",
      }),
    );
  });

  test("It should not let user add their own metadata when creating or replacing a document", async () => {
    const response = await kuzzle.document.createOrReplace(
      index,
      collection,
      "test",
      {
        foo: "bar",
        _kuzzle_info: {
          author: "foo",
          createdAt: 42,
          updatedAt: null,
          updater: null,
        },
      },
      { refresh: "wait_for" },
    );

    expect(response._source._kuzzle_info).toEqual(
      expect.not.objectContaining({
        author: "foo",
        createdAt: 42,
        updatedAt: null,
        updater: null,
      }),
    );
  });

  test("It should add custom metadata using the pipe", async () => {
    const response = await kuzzle.document.createOrReplace(
      index,
      collection,
      "test",
      { foo: "bar", addCustomMetadata: true },
      { refresh: "wait_for" },
    );

    // @ts-ignore
    expect(response._source._kuzzle_info).toEqual(
      expect.objectContaining({
        customMetadata: "customized",
      }),
    );
  });
});

describe("document:update", () => {
  test("It should update the metadata when updating a document", async () => {
    await kuzzle.document.createOrReplace(
      index,
      collection,
      "test",
      { foo: "bar" },
      { refresh: "wait_for" },
    );

    const response = await kuzzle.document.update(
      index,
      collection,
      "test",
      { foo: "bar" },
      { refresh: "wait_for", source: true },
    );

    // @ts-ignore
    expect(response._source._kuzzle_info).toBeDefined();
  });

  test("It should not let user add their own metadata when updating a document", async () => {
    await kuzzle.document.createOrReplace(
      index,
      collection,
      "test",
      { foo: "bar" },
      { refresh: "wait_for" },
    );

    const response = await kuzzle.document.update(
      index,
      collection,
      "test",
      {
        foo: "bar",
        _kuzzle_info: {
          author: "foo",
          createdAt: 42,
          updatedAt: null,
          updater: null,
        },
      },
      { refresh: "wait_for", source: true },
    );

    expect(response._source._kuzzle_info).toEqual(
      expect.not.objectContaining({
        author: "foo",
        createdAt: 42,
        updatedAt: null,
        updater: null,
      }),
    );
  });

  test("It should add custom metadata using the pipe", async () => {
    const createResponse = await kuzzle.document.createOrReplace(
      index,
      collection,
      "test",
      { foo: "bar" },
      { refresh: "wait_for" },
    );

    // @ts-ignore
    expect(createResponse._source._kuzzle_info).toEqual(
      expect.not.objectContaining({
        customMetadata: "customized",
      }),
    );

    const response = await kuzzle.document.update(
      index,
      collection,
      "test",
      { foo: "bar", addCustomMetadata: true },
      { refresh: "wait_for", source: true },
    );

    // @ts-ignore
    expect(response._source._kuzzle_info).toEqual(
      expect.objectContaining({
        customMetadata: "customized",
      }),
    );
  });
});

describe("document:replace", () => {
  test("It should replace the metadata", async () => {
    await kuzzle.document.createOrReplace(
      index,
      collection,
      "test",
      { foo: "bar" },
      { refresh: "wait_for" },
    );

    const response = await kuzzle.document.replace(
      index,
      collection,
      "test",
      { foo: "baz" },
      { refresh: "wait_for" },
    );

    // @ts-ignore
    expect(response._source._kuzzle_info).toBeDefined();
  });

  test("It should not let user add their own metadata", async () => {
    await kuzzle.document.createOrReplace(
      index,
      collection,
      "test",
      { foo: "bar" },
      { refresh: "wait_for" },
    );

    const response = await kuzzle.document.replace(
      index,
      collection,
      "test",
      {
        foo: "bar",
        _kuzzle_info: {
          author: "foo",
          createdAt: 42,
          updatedAt: null,
          updater: null,
        },
      },
      { refresh: "wait_for" },
    );

    // @ts-ignore
    expect(response._source._kuzzle_info).toEqual(
      expect.not.objectContaining({
        author: "foo",
        createdAt: 42,
        updatedAt: null,
        updater: null,
      }),
    );
  });

  test("It should add custom metadata using the pipe", async () => {
    const createResponse = await kuzzle.document.createOrReplace(
      index,
      collection,
      "test",
      { foo: "bar" },
      { refresh: "wait_for" },
    );

    // @ts-ignore
    expect(createResponse._source._kuzzle_info).toEqual(
      expect.not.objectContaining({
        customMetadata: "customized",
      }),
    );

    const response = await kuzzle.document.replace(
      index,
      collection,
      "test",
      { foo: "bar", addCustomMetadata: true },
      { refresh: "wait_for" },
    );

    // @ts-ignore
    expect(response._source._kuzzle_info).toEqual(
      expect.objectContaining({
        customMetadata: "customized",
      }),
    );
  });
});

describe("document:mCreate", () => {
  test("It should add the metadata when doing an mCreate", async () => {
    const response = await kuzzle.document.mCreate(
      index,
      collection,
      [{ body: { foo: "bar" } }],
      { refresh: "wait_for" },
    );

    expect(response.successes[0]._source._kuzzle_info).toBeDefined();
  });

  test("It should not let user add their own metadata to the document", async () => {
    const response = await kuzzle.document.mCreate(
      index,
      collection,
      [
        {
          body: {
            foo: "bar",
            _kuzzle_info: {
              author: "foo",
              createdAt: 42,
              updatedAt: null,
              updater: null,
            },
          },
        },
      ],
      { refresh: "wait_for" },
    );

    expect(response.successes[0]._source._kuzzle_info).toEqual(
      expect.not.objectContaining({
        author: "foo",
        createdAt: 42,
        updatedAt: null,
        updater: null,
      }),
    );
  });
});

describe("document:mCreateOrReplace", () => {
  test("It should add the metadata", async () => {
    const response = await kuzzle.document.mCreateOrReplace(
      index,
      collection,
      [{ _id: "test", body: { foo: "bar" } }],
      { refresh: "wait_for" },
    );

    expect(response.successes[0]._source._kuzzle_info).toBeDefined();
  });

  test("It should not let user add their own metadata to the document", async () => {
    const response = await kuzzle.document.mCreateOrReplace(
      index,
      collection,
      [
        {
          _id: "test",
          body: {
            foo: "bar",
            _kuzzle_info: {
              author: "foo",
              createdAt: 42,
              updatedAt: null,
              updater: null,
            },
          },
        },
      ],
      { refresh: "wait_for" },
    );

    expect(response.successes[0]._source._kuzzle_info).toEqual(
      expect.not.objectContaining({
        author: "foo",
        createdAt: 42,
        updatedAt: null,
        updater: null,
      }),
    );
  });
});

describe("document:mReplace", () => {
  test("It should add the metadata", async () => {
    await kuzzle.document.createOrReplace(
      index,
      collection,
      "test",
      { foo: "bar" },
      { refresh: "wait_for" },
    );

    const response = await kuzzle.document.mReplace(
      index,
      collection,
      [{ _id: "test", body: { foo: "bar" } }],
      { refresh: "wait_for" },
    );

    expect(response.successes[0]._source._kuzzle_info).toBeDefined();
  });

  test("It should not let user add their own metadata to the document", async () => {
    await kuzzle.document.createOrReplace(
      index,
      collection,
      "test",
      { foo: "bar" },
      { refresh: "wait_for" },
    );

    const response = await kuzzle.document.mReplace(
      index,
      collection,
      [
        {
          _id: "test",
          body: {
            foo: "bar",
            _kuzzle_info: {
              author: "foo",
              createdAt: 42,
              updatedAt: null,
              updater: null,
            },
          },
        },
      ],
      { refresh: "wait_for" },
    );

    expect(response.successes[0]._source._kuzzle_info).toEqual(
      expect.not.objectContaining({
        author: "foo",
        createdAt: 42,
        updatedAt: null,
        updater: null,
      }),
    );
  });
});

describe("document:upsert", () => {
  test("It should add the metadata", async () => {
    const response = await kuzzle.document.upsert(
      index,
      collection,
      "test",
      { foo: "baz" },
      { refresh: "wait_for", default: { foo: "bar" }, source: true },
    );

    // @ts-ignore
    expect(response._source._kuzzle_info).toBeDefined();
  });

  test("It should not let user add their own metadata", async () => {
    const response = await kuzzle.document.upsert(
      index,
      collection,
      "test",
      {
        foo: "baz",
        // @ts-ignore
        _kuzzle_info: {
          author: "foo",
          createdAt: 42,
          updatedAt: null,
          updater: null,
        },
      },
      { refresh: "wait_for", default: { foo: "bar" }, source: true },
    );

    // @ts-ignore
    expect(response._source._kuzzle_info).toEqual(
      expect.not.objectContaining({
        author: "foo",
        createdAt: 42,
        updatedAt: null,
        updater: null,
      }),
    );
  });

  test("It should add custom metadata using the pipe", async () => {
    const createResponse = await kuzzle.document.createOrReplace(
      index,
      collection,
      "test",
      { foo: "bar" },
      { refresh: "wait_for" },
    );

    // @ts-ignore
    expect(createResponse._source._kuzzle_info).toEqual(
      expect.not.objectContaining({
        customMetadata: "customized",
      }),
    );

    const response = await kuzzle.document.upsert(
      index,
      collection,
      "test",
      { foo: "bar", addCustomMetadata: true },
      { refresh: "wait_for", source: true },
    );

    // @ts-ignore
    expect(response._source._kuzzle_info).toEqual(
      expect.objectContaining({
        customMetadata: "customized",
      }),
    );
  });
});

describe("document:mUpsert", () => {
  test("It should add the metadata", async () => {
    const response = await kuzzle.document.mUpsert(
      index,
      collection,
      [
        {
          _id: "test",
          changes: { foo: "baz" },
          default: { foo: "bar" },
        },
      ],
      { refresh: "wait_for", source: true },
    );

    // @ts-ignore
    expect(response.successes[0]._source._kuzzle_info).toBeDefined();
  });

  test("It should not let user add their own metadata to the document", async () => {
    const response = await kuzzle.document.mUpsert(
      index,
      collection,
      [
        {
          _id: "test",
          changes: {
            foo: "baz",
            // @ts-ignore
            _kuzzle_info: {
              author: "foo",
              createdAt: 42,
              updatedAt: null,
              updater: null,
            },
          },
          default: { foo: "bar" },
        },
      ],
      { refresh: "wait_for", source: true },
    );

    // @ts-ignore
    expect(response.successes[0]._source._kuzzle_info).toEqual(
      expect.not.objectContaining({
        author: "foo",
        createdAt: 42,
        updatedAt: null,
        updater: null,
      }),
    );
  });
});

describe("document:updateByQuery", () => {
  beforeEach(async () => {
    await kuzzle.collection.truncate(index, collection, {
      refresh: "wait_for",
    });
  });

  test("It should update the metadata", async () => {
    await kuzzle.document.createOrReplace(
      index,
      collection,
      "test",
      { foo: "bar" },
      { refresh: "wait_for" },
    );

    const response = await kuzzle.document.updateByQuery(
      index,
      collection,
      {},
      { foo: "baz" },
      { refresh: "wait_for", source: true },
    );

    // @ts-ignore
    expect(response.successes[0]._source._kuzzle_info).toBeDefined();
  });

  test("It should not let user add their own metadata to the document", async () => {
    await kuzzle.document.createOrReplace(
      index,
      collection,
      "test",
      { foo: "bar" },
      { refresh: "wait_for" },
    );

    const response = await kuzzle.document.updateByQuery(
      index,
      collection,
      {},
      {
        foo: "bar",
        _kuzzle_info: {
          author: "custom author",
          createdAt: 12,
          updatedAt: null,
          updater: null,
        },
      },
      { refresh: "wait_for", source: true },
    );

    expect(response.successes[0]._source._kuzzle_info).not.toMatchObject({
      author: "custom author",
      createdAt: 12,
    });
    const doc = await kuzzle.document.get(index, collection, "test");
    expect(doc._source._kuzzle_info).not.toMatchObject({
      author: "custom author",
      createdAt: 12,
      updatedAt: null,
      updater: null,
    });
  });
});
