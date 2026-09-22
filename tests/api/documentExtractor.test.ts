import type { JSONObject } from "kuzzle-sdk";
import { describe, expect, it } from "vitest";

import DocumentExtractor from "../../lib/api/documentExtractor";
import type { KuzzleRequest } from "../../lib/api/request/kuzzleRequest";
import { Request } from "../../lib/api/request/kuzzleRequest";
import { BadRequestError } from "../../lib/kerror/errors/badRequestError";
import { InternalError } from "../../lib/kerror/errors/internalError";
import { invalid } from "../helpers/invalid";

/*
 * The Mocha spec stated sixteen actions in sixteen `describe` blocks and
 * 1 484 lines, but there are only **nine shapes** in it: `create`,
 * `createOrReplace`, `replace` and `update` were byte-identical apart from the
 * action name, and so were the four `m*` write actions (those three differed
 * only in having lost the word "should" from three test names), and `delete`
 * and `get`. Stating a shape once and naming the actions that share it is the
 * same move [L1b4] made for the two `esWrapper` specs: the duplication was in
 * the spec, not in the subject.
 *
 * The test count is unchanged — 57 in, 57 out — because each action still runs
 * every case of its shape.
 */

/** `input.body` is `JSONObject | null` on every request. */
const bodyOf = (request: KuzzleRequest) =>
  invalid<JSONObject>(request.input.body);

/** `result` is `any` on the way in and untyped on the way out. */
const resultOf = (request: KuzzleRequest) =>
  invalid<JSONObject>(request.result);

const withResult = (data: JSONObject, result: JSONObject) => {
  const request = new Request(data);

  request.setResult(result);

  return request;
};

describe("#api/DocumentExtractor", () => {
  it("should throw if no document extractor is defined", () => {
    const request = new Request({ action: "ohnoes" });

    const construct = () => new DocumentExtractor(request);

    expect(construct).toThrowError(InternalError);
    expect(construct).toThrowError(
      expect.objectContaining({ id: "core.fatal.assertion_failed" }),
    );
  });

  /**
   * One document carried in `_id` + `body`, answered in `_id` + `_source`.
   */
  const describeSingleDocument = (action: string) =>
    describe(`#${action}`, () => {
      const data = { _id: "foobar", action, body: { foo: "bar" } };
      const replacement = [{ _id: "foobar", _source: { foo: "baz" } }];

      it("should extract documents from request", () => {
        const documents = new DocumentExtractor(new Request(data)).extract();

        expect(documents).toHaveLength(1);
        expect(documents[0]._source.foo).toBe("bar");
        expect(documents[0]._id).toBe("foobar");
      });

      it("should insert documents from request", () => {
        const request = new Request({ action, body: { foo: "bar" } });

        const newReq = new DocumentExtractor(request).insert(replacement);

        expect(newReq.input.args._id).toBe("foobar");
        expect(bodyOf(newReq).foo).toBe("baz");
      });

      it("should extract documents from result", () => {
        const request = withResult(data, {
          _id: "foobaz",
          _source: { foo: "baz" },
        });

        const documents = new DocumentExtractor(request).extract();

        expect(documents).toHaveLength(1);
        expect(documents[0]._source.foo).toBe("baz");
        expect(documents[0]._id).toBe("foobaz");
      });

      it("should insert documents from result", () => {
        const request = withResult({ action, body: { foo: "bar" } }, {});

        const newReq = new DocumentExtractor(request).insert(replacement);

        expect(resultOf(newReq)._id).toBe("foobar");
        expect(resultOf(newReq)._source.foo).toBe("baz");
      });
    });

  for (const action of ["create", "createOrReplace", "replace", "update"]) {
    describeSingleDocument(action);
  }

  /**
   * Many documents carried in `body.documents` as `_id` + `body`, answered in
   * `result.successes` as `_id` + `_source`.
   */
  const describeMultiDocument = (action: string) =>
    describe(`#${action}`, () => {
      const data = {
        action,
        body: {
          documents: [
            { _id: "abc", body: { foo: "bar" } },
            { _id: "def", body: { baz: "qux" } },
          ],
        },
      };
      const replacement = [
        { _id: "foo", _source: { foo: "qux" } },
        { _id: "foo2", _source: { foo: "bar" } },
        { _id: "foo3", _source: { foo: "baz" } },
      ];
      const successes = [
        { _id: "fooabc", _source: { a: "b" } },
        { _id: "foodef", _source: { c: "d" } },
      ];

      it("should extract documents from request", () => {
        const documents = new DocumentExtractor(new Request(data)).extract();

        expect(documents).toHaveLength(2);
        expect(documents[0]._id).toBe("abc");
        expect(documents[0]._source.foo).toBe("bar");
        expect(documents[1]._id).toBe("def");
        expect(documents[1]._source.baz).toBe("qux");
      });

      it("should insert documents from request", () => {
        const newReq = new DocumentExtractor(new Request(data)).insert(
          replacement,
        );

        expect(bodyOf(newReq).documents).toMatchObject([
          { _id: "foo", body: { foo: "qux" } },
          { _id: "foo2", body: { foo: "bar" } },
          { _id: "foo3", body: { foo: "baz" } },
        ]);
      });

      it("should extract documents from result", () => {
        const request = withResult(data, { errors: [], successes });

        const documents = new DocumentExtractor(request).extract();

        expect(documents).toHaveLength(2);
        expect(documents[0]._id).toBe("fooabc");
        expect(documents[0]._source.a).toBe("b");
        expect(documents[1]._id).toBe("foodef");
        expect(documents[1]._source.c).toBe("d");
      });

      it("should insert documents from result", () => {
        const request = withResult(data, {});

        const newReq = new DocumentExtractor(request).insert(replacement);

        expect(resultOf(newReq).successes).toMatchObject(replacement);
      });
    });

  for (const action of ["mCreate", "mCreateOrReplace", "mReplace", "mUpdate"]) {
    describeMultiDocument(action);
  }

  /**
   * One document identified by `_id` alone, with no body either way.
   */
  const describeIdOnly = (action: string) =>
    describe(`#${action}`, () => {
      const data = { _id: "foobar", action };
      const replacement = [{ _id: "foobaz" }];

      it("should extract documents from request", () => {
        const documents = new DocumentExtractor(new Request(data)).extract();

        expect(documents).toHaveLength(1);
        expect(documents[0]._id).toBe("foobar");
      });

      it("should insert documents from request", () => {
        const newReq = new DocumentExtractor(new Request(data)).insert(
          replacement,
        );

        expect(newReq.input.args._id).toBe("foobaz");
      });

      it("should extract documents from result", () => {
        const request = withResult(data, { _id: "foobaz" });

        const documents = new DocumentExtractor(request).extract();

        expect(documents).toHaveLength(1);
        expect(documents[0]._id).toBe("foobaz");
      });

      it("should insert documents from result", () => {
        const request = withResult(data, {});

        const newReq = new DocumentExtractor(request).insert(replacement);

        expect(resultOf(newReq)._id).toBe("foobaz");
      });
    });

  for (const action of ["delete", "get"]) {
    describeIdOnly(action);
  }

  describe("#updateByQuery", () => {
    const data = {
      action: "updateByQuery",
      body: { changes: { foo: "bar" }, query: {} },
    };
    const replacement = [
      { _id: "foo", _source: { foo: "qux" } },
      { _id: "foo2", _source: { foo: "bar" } },
      { _id: "foo3", _source: { foo: "baz" } },
    ];

    it("should extract documents from result", () => {
      const request = withResult(data, {
        errors: [],
        successes: [
          { _id: "fooabc", _source: { a: "b" } },
          { _id: "foodef", _source: { c: "d" } },
        ],
      });

      const documents = new DocumentExtractor(request).extract();

      expect(documents).toHaveLength(2);
      expect(documents[0]._id).toBe("fooabc");
      expect(documents[0]._source.a).toBe("b");
      expect(documents[1]._id).toBe("foodef");
      expect(documents[1]._source.c).toBe("d");
    });

    it("should insert documents from result", () => {
      const request = withResult(data, {});

      const newReq = new DocumentExtractor(request).insert(replacement);

      expect(resultOf(newReq).successes).toMatchObject(replacement);
    });
  });

  describe("#mDelete", () => {
    const data = { action: "mDelete", body: { ids: ["foobar", "bazqux"] } };
    const replacement = [{ _id: "foo" }, { _id: "bar" }, { _id: "baz" }];

    it("should extract documents from request", () => {
      const documents = new DocumentExtractor(new Request(data)).extract();

      expect(documents).toHaveLength(2);
      expect(documents[0]._id).toBe("foobar");
      expect(documents[1]._id).toBe("bazqux");
    });

    it("should insert documents from request", () => {
      const newReq = new DocumentExtractor(new Request(data)).insert(
        replacement,
      );

      expect(bodyOf(newReq).ids).toEqual(["foo", "bar", "baz"]);
    });

    it("should extract documents from result", () => {
      const request = withResult(data, {
        errors: [],
        successes: ["foobar", "foobaz"],
      });

      const documents = new DocumentExtractor(request).extract();

      expect(documents).toHaveLength(2);
      expect(documents[0]._id).toBe("foobar");
      expect(documents[1]._id).toBe("foobaz");
    });

    it("should insert documents from result", () => {
      const request = withResult(data, {});

      const newReq = new DocumentExtractor(request).insert(replacement);

      expect(resultOf(newReq).successes).toEqual(["foo", "bar", "baz"]);
    });
  });

  describe("#mGet", () => {
    const replacement = [{ _id: "foo" }, { _id: "bar" }, { _id: "baz" }];

    it("should extract documents from request with a body", () => {
      const request = new Request({
        action: "mGet",
        body: { ids: ["foobar", "bazqux"] },
      });

      const documents = new DocumentExtractor(request).extract();

      expect(documents).toHaveLength(2);
      expect(documents[0]._id).toBe("foobar");
      expect(documents[1]._id).toBe("bazqux");
    });

    it("should extract documents from request with an array of ids as argument", () => {
      const request = new Request({
        action: "mGet",
        body: {},
        ids: ["foobar", "bazqux"],
      });

      const documents = new DocumentExtractor(request).extract();

      expect(documents).toHaveLength(2);
      expect(documents[0]._id).toBe("foobar");
      expect(documents[1]._id).toBe("bazqux");
    });

    it("should extract documents from request with query string", () => {
      const request = new Request({
        action: "mGet",
        body: {},
        ids: "foobar,bazqux",
      });

      const documents = new DocumentExtractor(request).extract();

      expect(documents).toHaveLength(2);
      expect(documents[0]._id).toBe("foobar");
      expect(documents[1]._id).toBe("bazqux");
    });

    it("should throw trying to extract documents from request with wrong type argument", () => {
      const request = new Request({ action: "mGet", body: {}, ids: 123 });

      expect(() => new DocumentExtractor(request).extract()).toThrowError(
        BadRequestError,
      );
    });

    it("should insert documents from request with a body", () => {
      const request = new Request({
        action: "mGet",
        body: { ids: ["foobar", "bazqux"] },
      });

      const newReq = new DocumentExtractor(request).insert(replacement);

      expect(bodyOf(newReq).ids).toEqual(["foo", "bar", "baz"]);
    });

    it("should insert documents from request with a query string", () => {
      /* The Mocha spec wrapped this one's `ids` in an `args` key, which lands
       * as `input.args.args`; what actually selects the argument branch is the
       * empty body. Kept as the branch it is about, written as it reads. */
      const request = new Request({
        action: "mGet",
        body: {},
        ids: "foobar,bazqux",
      });

      const newReq = new DocumentExtractor(request).insert(replacement);

      expect(newReq.input.args.ids).toEqual(["foo", "bar", "baz"]);
    });
  });

  describe("#search", () => {
    const data = { action: "search", body: { query: {} } };
    const result = {
      aggregations: "fooaggregations",
      hits: [
        { _id: "fooabc", _source: { a: "b" } },
        { _id: "foodef", _source: { c: "d" } },
      ],
      scrollId: "fooscroll",
      total: 42,
    };
    const replacement = [
      { _id: "foo", _source: { foo: "qux" } },
      { _id: "foo2", _source: { foo: "bar" } },
      { _id: "foo3", _source: { foo: "baz" } },
    ];

    it("should extract documents from result", () => {
      const documents = new DocumentExtractor(
        withResult(data, result),
      ).extract();

      expect(documents).toHaveLength(2);
      expect(documents[0]._id).toBe("fooabc");
      expect(documents[0]._source.a).toBe("b");
      expect(documents[1]._id).toBe("foodef");
      expect(documents[1]._source.c).toBe("d");
    });

    it("should insert documents from result", () => {
      const newReq = new DocumentExtractor(withResult(data, result)).insert(
        replacement,
      );

      expect(resultOf(newReq).hits).toMatchObject(replacement);
      // The rest of the search envelope survives the replacement.
      expect(resultOf(newReq).total).toBe(42);
      expect(resultOf(newReq).aggregations).toBe("fooaggregations");
      expect(resultOf(newReq).scrollId).toBe("fooscroll");
    });
  });

  describe("#deleteByQuery", () => {
    const data = { action: "deleteByQuery", body: { query: {} } };
    const result = {
      documents: [
        { _id: "fooabc", _source: { a: "b" } },
        { _id: "foodef", _source: { c: "d" } },
      ],
    };
    const replacement = [
      { _id: "foo", _source: { foo: "qux" } },
      { _id: "foo2", _source: { foo: "bar" } },
      { _id: "foo3", _source: { foo: "baz" } },
    ];

    it("should extract documents from result", () => {
      const documents = new DocumentExtractor(
        withResult(data, result),
      ).extract();

      expect(documents).toHaveLength(2);
      expect(documents[0]._id).toBe("fooabc");
      expect(documents[0]._source.a).toBe("b");
      expect(documents[1]._id).toBe("foodef");
      expect(documents[1]._source.c).toBe("d");
    });

    it("should insert documents from result", () => {
      const newReq = new DocumentExtractor(withResult(data, result)).insert(
        replacement,
      );

      expect(resultOf(newReq).documents).toMatchObject(replacement);
    });
  });
});
