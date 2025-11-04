import { Kuzzle, WebSocket } from "kuzzle-sdk";

const kuzzle = new Kuzzle(new WebSocket("localhost"));
const index = "garden";
const collection = "fruits";
const documentId = "test-document";

beforeAll(async () => {
  await kuzzle.connect();

  if (!(await kuzzle.index.exists(index))) {
    await kuzzle.index.create(index);
  }
  if (!(await kuzzle.collection.exists(index, collection))) {
    await kuzzle.collection.create(index, collection, {
      mappings: {
        properties: {
          value: {
            type: "keyword",
          },
          field: {
            properties: {
              path: {
                type: "keyword",
              },
            },
          },
        },
      },
    });
  }
});

afterAll(async () => {
  if (await kuzzle.index.exists(index)) {
    await kuzzle.index.delete(index);
  }

  kuzzle.disconnect();
});

beforeEach(async () => {
  await kuzzle.document.createOrReplace(index, collection, documentId, {
    value: "strawberry",
    field: {
      path: "forever",
    },
  });
});

afterEach(async () => {
  await kuzzle.collection.truncate(index, collection);
});

describe("mWrite", () => {
  it("It should create or replace documents", async () => {
    const mWrite = await kuzzle.bulk.mWrite(
      index,
      collection,
      [
        {
          _id: documentId,
          body: {
            value: "blueberry",
            field: {
              path: "never",
            },
          },
        },
        {
          _id: "new-document",
          body: {
            value: "raspberry",
            field: {
              path: "sometimes",
            },
          },
        },
      ],
      {
        refresh: "wait_for",
      },
    );

    expect(mWrite).toMatchObject({
      errors: [],
      successes: [
        {
          _id: documentId,
          _source: {
            value: "blueberry",
            field: {
              path: "never",
            },
          },
        },
        {
          _id: "new-document",
          _source: {
            value: "raspberry",
            field: {
              path: "sometimes",
            },
          },
        },
      ],
    });
    const updatedDocument = await kuzzle.document.get(
      index,
      collection,
      documentId,
    );
    expect(updatedDocument).toMatchObject({
      _id: documentId,
      _source: {
        value: "blueberry",
        field: { path: "never" },
      },
    });
  });
  it("It should not add any _kuzzle_info field to the document", async () => {
    await kuzzle.bulk.mWrite(
      index,
      collection,
      [
        {
          _id: documentId,
          body: {
            value: "blueberry",
            field: {
              path: "never",
            },
          },
        },
      ],
      {
        refresh: "wait_for",
      },
    );

    const updatedDocument = await kuzzle.document.get(
      index,
      collection,
      documentId,
    );
    expect(updatedDocument._source).not.toHaveProperty("_kuzzle_info");
  });
  it("It should let user write docs with _kuzzle_info", async () => {
    await kuzzle.bulk.mWrite(
      index,
      collection,
      [
        {
          _id: documentId,
          body: {
            value: "blueberry",
            field: {
              path: "never",
            },
            _kuzzle_info: {
              author: "custom-author",
            },
          },
        },
      ],
      {
        refresh: "wait_for",
      },
    );

    const updatedDocument = await kuzzle.document.get(
      index,
      collection,
      documentId,
    );
    expect(updatedDocument._source).toHaveProperty("_kuzzle_info");
    expect(updatedDocument._source._kuzzle_info?.author).toBe("custom-author");
  });
});
