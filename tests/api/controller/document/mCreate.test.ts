import { beforeAll, afterAll, describe, expect, afterEach, it } from "vitest";
import { Kuzzle, WebSocket } from "kuzzle-sdk";

const kuzzle = new Kuzzle(new WebSocket("localhost"));
const index = "food";
const collection = "fruits";

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

afterEach(async () => {
  await kuzzle.collection.truncate(index, collection);
});

describe("mCreate", () => {
  it("It should create document if not exists", async () => {
    const mCreateResult = await kuzzle.document.mCreate(
      index,
      collection,
      [
        {
          _id: "A",
          body: {
            value: "A",
          },
        },
      ],
      {
        refresh: "wait_for",
      },
    );

    expect(mCreateResult.successes.length).toEqual(1);

    const result = await kuzzle.document.mGet(index, collection, ["A"]);

    expect(result.successes.length).toEqual(1);
    expect(result.successes[0]._source).toMatchObject({
      value: "A",
    });
  });

  it("It should not replace the document if not exists", async () => {
    let mCreateResult = await kuzzle.document.mCreate(
      index,
      collection,
      [
        {
          _id: "A",
          body: {
            value: "A",
          },
        },
      ],
      {
        refresh: "wait_for",
      },
    );

    expect(mCreateResult.successes.length).toEqual(1);

    mCreateResult = await kuzzle.document.mCreate(
      index,
      collection,
      [
        {
          _id: "A",
          body: {
            value: "FOO",
          },
        },
      ],
      {
        refresh: "wait_for",
      },
    );

    expect(mCreateResult.successes.length).toEqual(0);
    expect(mCreateResult.errors.length).toEqual(1);

    const result = await kuzzle.document.mGet(index, collection, ["A"]);

    expect(result.successes.length).toEqual(1);
    expect(result.successes[0]._source).toMatchObject({
      value: "A",
    });
  });

  it("It should not replace the document even if the previous document did not exist", async () => {
    let mCreateResult = await kuzzle.document.mCreate(
      index,
      collection,
      [
        {
          _id: "A",
          body: {
            value: "A",
          },
        },
        {
          _id: "C",
          body: {
            value: "C",
          },
        },
      ],
      {
        refresh: "wait_for",
      },
    );

    expect(mCreateResult.successes.length).toEqual(2);

    mCreateResult = await kuzzle.document.mCreate(
      index,
      collection,
      [
        {
          _id: "A",
          body: {
            value: "FOO",
          },
        },
        {
          _id: "B",
          body: {
            value: "B",
          },
        },
        {
          _id: "C",
          body: {
            value: "FOO",
          },
        },
      ],
      {
        refresh: "wait_for",
      },
    );

    expect(mCreateResult.successes.length).toEqual(1);
    expect(mCreateResult.errors.length).toEqual(2);

    const result = await kuzzle.document.mGet(index, collection, [
      "A",
      "B",
      "C",
    ]);

    expect(result.successes.length).toEqual(3);
    expect(result.successes[0]._source).toMatchObject({
      value: "A",
    });
    expect(result.successes[1]._source).toMatchObject({
      value: "B",
    });
    expect(result.successes[2]._source).toMatchObject({
      value: "C",
    });
  });
});
