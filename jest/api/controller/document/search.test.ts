import { Kuzzle, WebSocket } from "kuzzle-sdk";

const kuzzle = new Kuzzle(new WebSocket("localhost"));
const index = "cellular";
const collection = "iphone";

beforeAll(async () => {
  await kuzzle.connect();

  if (await kuzzle.index.exists(index)) {
    await kuzzle.index.delete(index);
  }

  await kuzzle.index.create(index);
  await kuzzle.collection.create(index, collection, {
    mappings: {
      properties: {
        foo: {
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
  await kuzzle.index.delete(index);
  kuzzle.disconnect();
});

afterEach(async () => {
  await kuzzle.collection.truncate(index, collection);
});

describe("koncorde query", () => {
  describe("exists", () => {
    it("should return true if the field exists", async () => {
      const document = { foo: "bar" };

      await kuzzle.document.create(index, collection, document, undefined, {
        refresh: "wait_for",
      });

      const result = await kuzzle.document.search(
        index,
        collection,
        {
          query: {
            exists: {
              field: "foo",
            },
          },
        },
        {
          lang: "koncorde",
        }
      );

      expect(result.hits.length).toEqual(1);
    });

    it("should return false if the field does not exists", async () => {
      const document = { foo: "bar" };

      await kuzzle.document.create(index, collection, document, undefined, {
        refresh: "wait_for",
      });

      const result = await kuzzle.document.search(
        index,
        collection,
        {
          query: {
            exists: {
              field: "name",
            },
          },
        },
        {
          lang: "koncorde",
        }
      );

      expect(result.hits.length).toEqual(0);
    });

    it('should support the syntax "field.path[value]" and return document if matching', async () => {
      const document = { field: { path: ["ALPHA", "BETA"] } };

      await kuzzle.document.create(index, collection, document, undefined, {
        refresh: "wait_for",
      });

      const result = await kuzzle.document.search(
        index,
        collection,
        {
          query: {
            exists: {
              field: 'field.path["BETA"]',
            },
          },
        },
        {
          lang: "koncorde",
        }
      );

      expect(result.hits.length).toEqual(1);
    });

    it('should support the syntax "field.path[value]" and return nothing if not matching', async () => {
      const document = { field: { path: ["ALPHA", "BETA"] } };

      await kuzzle.document.create(index, collection, document, undefined, {
        refresh: "wait_for",
      });

      const result = await kuzzle.document.search(
        index,
        collection,
        {
          query: {
            exists: {
              field: 'field.path["GAMMA"]',
            },
          },
        },
        {
          lang: "koncorde",
        }
      );

      expect(result.hits.length).toEqual(0);
    });
  });
});
