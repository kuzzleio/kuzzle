import { Kuzzle, WebSocket } from "kuzzle-sdk";

const kuzzle = new Kuzzle(new WebSocket("localhost"));
const index = "food";
const collection = "fruits";
const documentId = "test-document";
beforeAll(async () => {
  await kuzzle.connect();

  if (await kuzzle.index.exists(index)) {
    await kuzzle.index.delete(index);
  }

  await kuzzle.index.create(index);
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

describe("update", () => {
  it("It should update a document", async () => {
    const update = await kuzzle.document.update(
      index,
      collection,
      documentId,
      {
        value: "blueberry",
        field: {
          path: "never",
        },
      },
      {
        refresh: "wait_for",
      },
    );

    expect(update).toMatchObject({
      _id: documentId,
      _source: {
        value: "blueberry",
        field: {
          path: "never",
        },
      },
    });
  });

  it("It should thorw if not exists", async () => {
    const update = kuzzle.document.update(
      index,
      collection,
      "no_id",
      {
        value: "blueberry",
        field: {
          path: "never",
        },
      },
      {
        refresh: "wait_for",
      },
    );

    expect(update).rejects.toThrow();
  });

  it("It should return only the edited content and _kuzzle_info", async () => {
    const now = Date.now();
    const update = await kuzzle.document.update(
      index,
      collection,
      documentId,
      {
        value: "blueberry",
      },
      {
        refresh: "wait_for",
      },
    );

    expect(update).toMatchObject({
      _id: documentId,
      _source: {
        value: "blueberry",
      },
    });
    expect(update._source).not.toHaveProperty("field");

    //@ts-ignore
    expect(update._source._kuzzle_info.updatedAt).toBeGreaterThanOrEqual(now);
  });
});
