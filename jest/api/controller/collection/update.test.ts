import { Kuzzle, WebSocket } from "kuzzle-sdk";

const kuzzle = new Kuzzle(new WebSocket("localhost"));
const index = "nyc-open-data";
const collection = "green-taxi";
const mappings = {
  dynamic: "false" as const,
  properties: {
    name: {
      type: "keyword",
    },
  },
};

beforeAll(async () => {
  await kuzzle.connect();
  if (await kuzzle.index.exists(index)) {
    await kuzzle.index.delete(index);
  }

  await kuzzle.index.create(index);
  await kuzzle.collection.create(index, collection, {
    mappings,
  });
});

afterAll(async () => {
  await kuzzle.index.delete(index);
  kuzzle.disconnect();
});

describe("collection:update", () => {
  it("should reindex the collection if asked to", async () => {
    await kuzzle.document.create(
      index,
      collection,
      { age: 42, name: "Bob" },
      "document-1",
      { refresh: "wait_for" },
    );

    let result = await kuzzle.document.search(index, collection, {
      query: {
        range: {
          age: {
            gte: 40,
          },
        },
      },
    });

    expect(result.hits.length).toEqual(0);

    await kuzzle.collection.update(index, collection, {
      mappings: { properties: { age: { type: "long" } } },
      reindexCollection: true,
    });

    // Wait for the reindexing to complete
    await new Promise((r) => setTimeout(r, 2000));

    result = await kuzzle.document.search(index, collection, {
      query: {
        range: {
          age: {
            gte: 40,
          },
        },
      },
    });

    expect(result.hits.length).toEqual(1);
  });
});
