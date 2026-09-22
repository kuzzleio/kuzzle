import { Koncorde } from "koncorde";
import type { JSONObject } from "kuzzle-sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { KuzzleRequest, Request } from "../../../lib/api/request/kuzzleRequest";
import { RequestContext } from "../../../lib/api/request/requestContext";
import { RequestInput } from "../../../lib/api/request/requestInput";
import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { InternalError } from "../../../lib/kerror/errors/internalError";
import { KuzzleError } from "../../../lib/kerror/errors/kuzzleError";
import { invalid } from "../../helpers/invalid";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

/**
 * Runs `fn` **once** and states what it threw.
 *
 * `should(fn).throw(Class, props)` checks both; `toThrow` takes one argument
 * and silently ignores a second, which is the codemod trap this step keeps
 * meeting. Running once also matters here: `getArray`/`getObject` rewrite
 * `input.args` on the way through, so a matcher that invokes `fn` twice would
 * be asserting against a different request the second time.
 */
const throws = (
  fn: () => unknown,
  match: JSONObject,
  error: new (...args: never[]) => Error = BadRequestError,
) => {
  let caught: unknown;

  try {
    fn();
  } catch (e) {
    caught = e;
  }

  expect(caught).toBeInstanceOf(error);
  expect(caught).toMatchObject(match);
};

describe("#api/request/KuzzleRequest", () => {
  let rq: Request;
  let nodeEnv: string | undefined;

  beforeEach(() => {
    /*
     * The whole of `global.kuzzle` this file needs. `KuzzleRequest` itself
     * reads only `global.NODE_ENV`; the one field is `RequestResponse`'s, and
     * it is spelled `(global as any).kuzzle.id`, which is why grepping for
     * `global.kuzzle` says this subject has no dependency at all.
     */
    stubKuzzle({ id: "knode-test" });

    nodeEnv = global.NODE_ENV;
    rq = new Request({});
  });

  afterEach(() => {
    global.NODE_ENV = nodeEnv;
    restoreKuzzle();
  });

  it("should defaults other properties correctly", () => {
    expect(rq.status).toBe(102);
    expect(rq.context).toBeInstanceOf(RequestContext);
    expect(rq.input).toBeInstanceOf(RequestInput);
    expect(rq.result).toBeNull();
    expect(rq.error).toBeNull();
    expect(rq.deprecations).toBeUndefined();
  });

  it("should initialize the request object with the provided options", () => {
    const result = { foo: "bar" };
    const error = new InternalError("foobar");
    const request = new Request(
      {},
      {
        connectionId: "connectionId",
        error,
        protocol: "protocol",
        result,
        status: 666,
        token: invalid({ token: "token" }),
        user: invalid({ user: "user" }),
      },
    );

    expect(request.status).toBe(666);
    expect(request.result).toBe(result);
    expect(request.error).toBe(error);
    expect(request.error).toBeInstanceOf(KuzzleError);
    expect(request.error.message).toBe(error.message);
    expect(request.error.stack).toBe(error.stack);
    // The Mocha spec compared `request.error.status` with itself. What it owes
    // is the status the error carried in.
    expect(request.error.status).toBe(error.status);
    expect(request.context.protocol).toBe("protocol");
    expect(request.context.connectionId).toBe("connectionId");
    expect(request.context.token).toMatchObject({ token: "token" });
    expect(request.context.user).toMatchObject({ user: "user" });
  });

  it("should instanciate a new KuzzleError object from a serialized error", () => {
    const result = { foo: "bar" };
    const error = new InternalError("foobar");
    const request = new Request(
      {},
      {
        connectionId: "connectionId",
        error: invalid(error.toJSON()),
        protocol: "protocol",
        result,
        status: 666,
        token: invalid({ token: "token" }),
        user: invalid({ user: "user" }),
      },
    );

    expect(request.status).toBe(666);
    expect(request.result).toBe(result);
    expect(request.error).toBeInstanceOf(KuzzleError);
    expect(request.error.message).toBe(error.message);
    expect(request.error.stack).toBe(error.stack);
    // Same tautology as above; the deserialized error must keep its status.
    expect(request.error.status).toBe(error.status);
    expect(request.context.protocol).toBe("protocol");
    expect(request.context.connectionId).toBe("connectionId");
    expect(request.context.token).toMatchObject({ token: "token" });
    expect(request.context.user).toMatchObject({ user: "user" });
  });

  it("should throw if a non-object options argument is provided", () => {
    for (const options of [[], "foobar", 123.45]) {
      expect(() => new Request({}, invalid(options))).toThrow(
        "Request options must be an object",
      );
    }
  });

  it("should throw if an invalid optional status is provided", () => {
    for (const status of [[], {}, "foobar", 123.45]) {
      expect(() => new Request({}, { status: invalid(status) })).toThrow(
        "Attribute status must be an integer",
      );
    }
  });

  it("should set an error properly", () => {
    const foo = new KuzzleError("bar", 666);

    rq.setError(foo);

    expect(rq.error).toBe(foo);
    expect(rq.status).toBe(666);

    expect(rq.error.toJSON()).toMatchObject({
      message: foo.message,
      status: foo.status,
    });
  });

  it("should wrap a plain Error object into an InternalError one", () => {
    const foo = new Error("bar");

    rq.setError(foo);

    expect(rq.error).not.toBe(foo);
    expect(rq.error).toBeInstanceOf(InternalError);
    expect(rq.error.message).toBe("bar");
    expect(rq.error.status).toBe(500);
    expect(rq.status).toBe(500);
  });

  it("should throw if attempting to set a non-error object as a request error", () => {
    expect(() => rq.setError(invalid("foo"))).toThrow(
      /^Cannot set non-error object.*$/,
    );
  });

  it("should set the provided result with default status 200", () => {
    const result = { foo: "bar" };

    rq.setResult(result);

    expect(rq.result).toBe(result);
    expect(rq.status).toBe(200);
  });

  it("should set a custom status code if one is provided", () => {
    const result = { foo: "bar" };

    rq.setResult(result, { status: 666 });

    expect(rq.result).toBe(result);
    expect(rq.status).toBe(666);
  });

  it("should throw if trying to set an error object as a result", () => {
    expect(() => rq.setResult(new Error("foobar"))).toThrow(
      /cannot set an error/,
    );
  });

  it("should throw if trying to set a non-integer status", () => {
    const setStatus = (request: Request, status: unknown) => () =>
      request.setResult("foobar", { status: invalid(status) });

    for (const status of [{}, [], true, 123.45]) {
      expect(setStatus(rq, status)).toThrow(
        "Attribute status must be an integer",
      );
    }
  });

  it("should throw if trying to set some non-object headers", () => {
    const setHeaders = (request: Request, headers: unknown) => () =>
      request.setResult("foobar", { headers: invalid(headers) });

    for (const headers of [42, [true, false], "bar", true]) {
      throws(setHeaders(rq, headers), {
        message: 'Attribute headers must be of type "object"',
      });
    }
  });

  it("should set the raw response indicator if provided", () => {
    const result = { foo: "bar" };

    expect(rq.response.raw).toBe(false);

    rq.setResult(result, { raw: true });

    expect(rq.result).toBe(result);
    expect(rq.response.raw).toBe(true);
  });

  it("should build a well-formed response", () => {
    const result = { foo: "bar" };
    const responseHeaders = { "X-Bar": "baz", "X-Foo": "bar" };
    const error = new InternalError("foobar");
    const data = {
      _id: "id",
      action: "action",
      collection: "collection",
      controller: "controller",
      index: "idx",
      volatile: { some: "meta" },
    };
    const request = new Request(data);

    request.setResult(result, { headers: responseHeaders, status: 201 });
    request.setError(error);

    const response = request.response;

    expect(response.status).toBe(500);
    expect(response.error).toBe(error);
    expect(response.requestId).toBe(request.id);
    expect(response.controller).toBe(data.controller);
    expect(response.action).toBe(data.action);
    expect(response.collection).toBe(data.collection);
    expect(response.index).toBe(data.index);
    expect(response.volatile).toMatchObject(data.volatile);
    expect(response.result).toBe(result);
    expect(response.headers).toMatchObject(responseHeaders);
  });

  it("should serialize the request correctly", () => {
    const result = { foo: "bar" };
    const error = new InternalError("foobar");
    const data = {
      _id: "id",
      action: "action",
      body: { some: "body" },
      collection: "collection",
      controller: "controller",
      foo: "bar",
      index: "idx",
      timestamp: "timestamp",
      volatile: { some: "meta" },
    };
    const options = {
      connection: {
        foobar: "barfoo",
        headers: { foo: "args.headers" },
        id: "connectionId",
        ips: ["i", "p", "s"],
        protocol: "protocol",
        url: "url",
      },
      status: 666,
    };
    const request = new Request(data, invalid(options));

    request.setResult(result);
    request.setError(error);

    const serialized = request.serialize();

    expect(serialized.data.body).toMatchObject({ some: "body" });
    expect(serialized.data.volatile).toMatchObject({ some: "meta" });
    expect(serialized.data.controller).toBe("controller");
    expect(serialized.data.action).toBe("action");
    expect(serialized.data.index).toBe("idx");
    expect(serialized.data.collection).toBe("collection");
    expect(serialized.data._id).toBe("id");
    expect(serialized.data.timestamp).toBe("timestamp");
    expect(serialized.data.foo).toBe("bar");

    expect(serialized.options.connection).toMatchObject(options.connection);
    expect(serialized.options.error).toMatchObject({
      message: error.message,
      status: error.status,
    });
    expect(serialized.options.result).toMatchObject(result);
    expect(serialized.options.status).toBe(500);

    // `serialize()` returns a deprecated `headers` its return type omits.
    expect(invalid<JSONObject>(serialized).headers).toMatchObject({
      foo: "args.headers",
    });

    const newRequest = new Request(serialized.data, serialized.options);

    expect(newRequest.response.toJSON()).toMatchObject(
      request.response.toJSON(),
    );
    /* `timestamp` is declared `number` and the request carries through
     * whatever it was given — the Mocha spec has always round-tripped the
     * string "timestamp". A third declaration this spec cannot honour. */
    expect(invalid<string>(newRequest.timestamp)).toBe("timestamp");
  });

  it("should clear the request error and status correctly", () => {
    const result = { foo: "bar" };
    const error = new InternalError("foobar");
    const request = new Request({
      _id: "id",
      action: "action",
      body: { some: "body" },
      collection: "collection",
      controller: "controller",
      foo: "bar",
      headers: { foo: "args.header" },
      index: "idx",
      timestamp: "timestamp",
      volatile: { some: "meta" },
    });

    request.input.headers = { foo: "input.header" };
    request.setResult(result);
    request.setError(error);

    expect(request.error).toBeInstanceOf(InternalError);

    request.clearError();

    expect(request.error).toBeNull();
    expect(request.status).toBe(200);
  });

  it("should add a deprecation when kuzzle is in development", () => {
    global.NODE_ENV = "development";
    rq.addDeprecation("1.0.0", "You should now use Kuzzle v2");

    expect(rq.deprecations).toEqual([
      { message: "You should now use Kuzzle v2", version: "1.0.0" },
    ]);
  });

  it("should not add a deprecation when kuzzle is in production", () => {
    global.NODE_ENV = "production";
    rq.addDeprecation("1.0.0", "You should now use Kuzzle v2");

    expect(rq.deprecations).toBeUndefined();
  });

  describe("param extraction methods", () => {
    let request: KuzzleRequest;

    beforeEach(() => {
      request = new KuzzleRequest({});
    });

    describe("#getLangParam", () => {
      beforeEach(() => {
        request.input.args = {};
      });

      it('should have "elasticsearch" has default value', () => {
        expect(request.getLangParam()).toBe("elasticsearch");
      });

      it('should retrieve the "lang" param', () => {
        request.input.args.lang = "koncorde";

        expect(request.getLangParam()).toBe("koncorde");
      });

      it('should throw an error if "lang" is invalid', () => {
        request.input.args.lang = "turkish";

        throws(() => request.getLangParam(), {
          id: "api.assert.invalid_argument",
        });
      });
    });

    describe("#getBoolean", () => {
      beforeEach(() => {
        request = new Request(
          { doha: 0 },
          { connection: invalid({ protocol: "http" }) },
        );
      });

      it("sets the flag value to true if present in http", () => {
        expect(request.getBoolean("doha")).toBe(true);
      });

      it("sets the flag value to false if not present in http", () => {
        delete request.input.args.doha;

        expect(request.getBoolean("doha")).toBe(false);
      });

      it("does nothing if the flag is already a boolean with other protocols", () => {
        request.context.connection.protocol = "ws";
        request.input.args.doha = false;

        expect(request.getBoolean("doha")).toBe(false);
      });

      it("throw an error if flag is not a boolean with other protocols", () => {
        request.context.connection.protocol = "ws";

        throws(() => request.getBoolean("doha"), {
          id: "api.assert.invalid_type",
        });
      });

      it('returns "false" if the flag is not set (not HTTP)', () => {
        request.context.connection.protocol = "ws";

        expect(request.getBoolean("ohnoes")).toBe(false);
      });
    });

    describe("#getBodyBoolean", () => {
      beforeEach(() => {
        request = new KuzzleRequest({ body: { doha: true } });
      });

      it("returns the value of the body boolean", () => {
        request.context.connection.protocol = "ws";
        expect(request.getBodyBoolean("doha")).toBe(true);

        request.input.body.doha = false;

        expect(request.getBodyBoolean("doha")).toBe(false);
      });

      it("returns the value of the body boolean even in HTTP", () => {
        request.context.connection.protocol = "http";
        expect(request.getBodyBoolean("doha")).toBe(true);

        request.input.body.doha = false;

        expect(request.getBodyBoolean("doha")).toBe(false);
      });
    });

    describe("#request body getters", () => {
      beforeEach(() => {
        request.input.body = {
          age: 3011.5,
          defeatedBugsAt: 11,
          fullname: "Andrew Wiggin",
          ids: JSON.stringify([1, 2, 3]),
          names: ["Ender", "Speaker for the Dead", "Xenocide"],
          otherPowers: JSON.stringify({ superman: "strength" }),
          powers: { fire: { damage: 10.8, level: "high", mana: 10 } },
          relations: {
            kobe: ["bryant", "jordan", "love"],
            lebron: ["james", "curry", "harden"],
          },
          relatives: { Peter: "brother", Valentine: "sister" },
          year: "5270",
        };
      });

      describe("#getBodyArray", () => {
        it("should return the array of the body (lodash parameter)", () => {
          expect(request.getBodyArray("relations.lebron")).toBe(
            request.input.body.relations.lebron,
          );
        });

        it("extracts the required parameter", () => {
          expect(request.getBodyArray("names")).toBe(request.input.body.names);
        });

        it("should throw if the parameter is missing", () => {
          throws(() => request.getBodyArray("childhood"), {
            id: "api.assert.missing_argument",
          });
        });

        it("should return the default value if provided, when the parameter is missing", () => {
          // `def` is declared `[] | undefined` — the empty TUPLE — on
          // getBodyArray/getArray/getArrayLegacy, so no caller can pass a
          // default with anything in it without a cast.
          const def = invalid<[]>(["foo"]);

          expect(request.getBodyArray("childhood", def)).toBe(def);
        });

        it("should throw if the parameter is not an array", () => {
          throws(() => request.getBodyArray("age"), {
            id: "api.assert.invalid_type",
          });
        });

        it("should throw if the request does not have a body", () => {
          request.input.body = null;

          throws(() => request.getBodyArray("names"), {
            id: "api.assert.body_required",
          });
        });

        it("should return the default value if one is provided, and if the request has no body", () => {
          // `def` is declared `[] | undefined` — the empty TUPLE — on
          // getBodyArray/getArray/getArrayLegacy, so no caller can pass a
          // default with anything in it without a cast.
          const def = invalid<[]>(["foo"]);

          request.input.body = null;

          expect(request.getBodyArray("names", def)).toBe(def);
        });

        it("should throw if the value is a string and not try to parse it since it is not a query string", () => {
          request.context.connection.protocol = "ws";
          throws(() => request.getBodyArray("ids"), {
            id: "api.assert.invalid_type",
          });

          request.context.connection.protocol = "http";
          throws(() => request.getBodyArray("ids"), {
            id: "api.assert.invalid_type",
          });
        });
      });

      describe("#getBodyString", () => {
        it("should return the string of the body (lodash parameter)", () => {
          expect(request.getBodyString("relatives.Peter")).toBe(
            request.input.body.relatives.Peter,
          );
        });

        it("should return the string of an array (lodash parameter)", () => {
          expect(request.getBodyString("names.0")).toBe(
            request.input.body.names[0],
          );
        });

        it("should return the string of an array (lodash bracket parameter)", () => {
          expect(request.getBodyString("relations.lebron[0]")).toBe(
            request.input.body.relations.lebron[0],
          );
        });

        it("extracts the required parameter", () => {
          expect(request.getBodyString("fullname")).toBe(
            request.input.body.fullname,
          );
        });

        it("should throw if the parameter is missing", () => {
          throws(() => request.getBodyString("childhood"), {
            id: "api.assert.missing_argument",
          });
        });

        it("should return the default value if provided, when the parameter is missing", () => {
          expect(request.getBodyString("childhood", "foo")).toBe("foo");
        });

        it("should throw if the parameter is not a string", () => {
          throws(() => request.getBodyString("age"), {
            id: "api.assert.invalid_type",
          });
        });

        it("should throw if the request does not have a body", () => {
          request.input.body = null;

          throws(() => request.getBodyString("fullname"), {
            id: "api.assert.body_required",
          });
        });

        it("should return the default value if one is provided, and if the request has no body", () => {
          request.input.body = null;

          expect(request.getBodyString("fullname", "foo")).toBe("foo");
        });
      });

      describe("#getBodyObject", () => {
        it("should return the object of the body (lodash parameter)", () => {
          expect(request.getBodyObject("powers.fire")).toBe(
            request.input.body.powers.fire,
          );
        });

        it("extracts the required parameter", () => {
          expect(request.getBodyObject("relatives")).toBe(
            request.input.body.relatives,
          );
        });

        it("should throw if the parameter is missing", () => {
          throws(() => request.getBodyObject("childhood"), {
            id: "api.assert.missing_argument",
          });
        });

        it("should return the default value if provided, when the parameter is missing", () => {
          const def = { foo: "bar" };

          expect(request.getBodyObject("childhood", def)).toBe(def);
        });

        it("should throw if the parameter is not an object", () => {
          throws(() => request.getBodyObject("age"), {
            id: "api.assert.invalid_type",
          });
        });

        it("should throw if the request does not have a body", () => {
          request.input.body = null;

          throws(() => request.getBodyObject("relatives"), {
            id: "api.assert.body_required",
          });
        });

        it("should return the default value if one is provided, and if the request has no body", () => {
          const def = { foo: "bar" };

          request.input.body = null;

          expect(request.getBodyObject("relatives", def)).toBe(def);
        });

        it("should throw if the value is a string and not try to parse it since it is not a query string", () => {
          request.context.connection.protocol = "ws";
          throws(() => request.getBodyObject("otherPowers"), {
            id: "api.assert.invalid_type",
          });

          request.context.connection.protocol = "http";
          throws(() => request.getBodyObject("otherPowers"), {
            id: "api.assert.invalid_type",
          });
        });
      });

      describe("#getBodyNumber", () => {
        it("should return the number of the body (lodash parameter)", () => {
          expect(request.getBodyNumber("powers.fire.damage")).toBe(
            request.input.body.powers.fire.damage,
          );
        });

        it("extracts the required parameter and convert it", () => {
          expect(request.getBodyNumber("age")).toBe(3011.5);
          expect(request.getBodyNumber("year")).toBe(5270);
        });

        it("should throw if the parameter is missing", () => {
          throws(() => request.getBodyNumber("childhood"), {
            id: "api.assert.missing_argument",
          });
        });

        it("should return the default value if provided, when the parameter is missing", () => {
          expect(request.getBodyNumber("childhood", 123)).toBe(123);
        });

        it("should throw if the parameter is not a number", () => {
          throws(() => request.getBodyNumber("fullname"), {
            id: "api.assert.invalid_type",
          });
        });

        it("should throw if the request does not have a body", () => {
          request.input.body = null;

          throws(() => request.getBodyNumber("age"), {
            id: "api.assert.body_required",
          });
        });

        it("should return the default value if one is provided, and if the request has no body", () => {
          request.input.body = null;

          expect(request.getBodyNumber("age", 123)).toBe(123);
        });
      });

      describe("#getBodyInteger", () => {
        it("should return the integer of the body (lodash parameter)", () => {
          expect(request.getBodyInteger("powers.fire.mana")).toBe(
            request.input.body.powers.fire.mana,
          );
        });

        it("extracts the required parameter and convert it", () => {
          expect(request.getBodyInteger("year")).toBe(5270);
          expect(request.getBodyInteger("defeatedBugsAt")).toBe(11);
        });

        it("should throw if the parameter is missing", () => {
          throws(() => request.getBodyInteger("childhood"), {
            id: "api.assert.missing_argument",
          });
        });

        it("should return the default value if provided, when the parameter is missing", () => {
          expect(request.getBodyInteger("childhood", 123)).toBe(123);
        });

        it("should throw if the parameter is not an integer", () => {
          throws(() => request.getBodyInteger("age"), {
            id: "api.assert.invalid_type",
          });

          throws(() => request.getBodyInteger("fullname"), {
            id: "api.assert.invalid_type",
          });
        });

        it("should throw if the request does not have a body", () => {
          request.input.body = null;

          throws(() => request.getBodyInteger("year"), {
            id: "api.assert.body_required",
          });
        });

        it("should return the default value if one is provided, and if the request has no body", () => {
          request.input.body = null;

          expect(request.getBodyInteger("year", 123)).toBe(123);
        });
      });
    });

    describe("#request argument getters", () => {
      beforeEach(() => {
        request.input.args = {
          age: 3011.5,
          badDate: "202-04-11T00:00:00.0",
          birthDate: "2022-04-11T00:00:00.000Z",
          birthDateDay: "2022-04-11",
          birthDateTime: 1649635200000,
          defeatedBugsAt: 11,
          fullname: "Andrew Wiggin",
          ids: JSON.stringify([1, 2, 3]),
          legacyArray: "1,2,3",
          names: ["Ender", "Speaker for the Dead", "Xenocide"],
          powers: JSON.stringify({ fire: 666 }),
          relatives: { Peter: "brother", Valentine: "sister" },
          year: "5270",
        };
      });

      describe("#getArray", () => {
        beforeEach(() => {
          request.context.connection.protocol = "http";
        });

        it("extracts the required parameter", () => {
          expect(request.getArray("names")).toBe(request.input.args.names);
        });

        it("should throw if the parameter is missing", () => {
          throws(() => request.getArray("childhood"), {
            id: "api.assert.missing_argument",
          });
        });

        it("should return the default value if provided, when the parameter is missing", () => {
          // `def` is declared `[] | undefined` — the empty TUPLE — on
          // getBodyArray/getArray/getArrayLegacy, so no caller can pass a
          // default with anything in it without a cast.
          const def = invalid<[]>(["foo"]);

          expect(request.getArray("childhood", def)).toBe(def);
        });

        it("should throw if the parameter is not an array", () => {
          throws(() => request.getArray("age"), {
            id: "api.assert.invalid_type",
          });
        });

        it("should try to parse if the value is a string and the protocol is HTTP", () => {
          expect(typeof request.input.args.ids).toBe("string");

          expect(request.getArray("ids")).toEqual([1, 2, 3]);

          // The parse is written back onto the request.
          expect(request.input.args.ids).toEqual([1, 2, 3]);
        });

        it("should throw if the value is a string but the protocol is not HTTP", () => {
          request.context.connection.protocol = "ws";

          throws(() => request.getArray("ids"), {
            id: "api.assert.invalid_type",
          });
        });

        it("should throw if the parsing of the string fails to give an array", () => {
          throws(() => request.getArray("fullname"), {
            id: "api.assert.invalid_type",
          });
        });
      });

      describe("#getArrayLegacy", () => {
        beforeEach(() => {
          request.context.connection.protocol = "http";
        });

        it("extracts the required parameter", () => {
          expect(request.getArrayLegacy("names")).toBe(
            request.input.args.names,
          );
        });

        it("should throw if the parameter is missing", () => {
          throws(() => request.getArrayLegacy("childhood"), {
            id: "api.assert.missing_argument",
          });
        });

        it("should return the default value if provided, when the parameter is missing", () => {
          // `def` is declared `[] | undefined` — the empty TUPLE — on
          // getBodyArray/getArray/getArrayLegacy, so no caller can pass a
          // default with anything in it without a cast.
          const def = invalid<[]>(["foo"]);

          expect(request.getArrayLegacy("childhood", def)).toBe(def);
        });

        it("should throw if the parameter is not an array", () => {
          throws(() => request.getArrayLegacy("age"), {
            id: "api.assert.invalid_type",
          });
        });

        it("should try to parse if the value is a string and the protocol is HTTP", () => {
          expect(request.getArrayLegacy("ids")).toEqual([1, 2, 3]);
        });

        it("should split the split if it failed to parse the string as a JSON array when the protocol is HTTP", () => {
          expect(request.getArrayLegacy("legacyArray")).toEqual([
            "1",
            "2",
            "3",
          ]);
        });

        it('should split the string on "," when the protocol is not HTTP', () => {
          request.context.connection.protocol = "ws";

          expect(request.getArrayLegacy("legacyArray")).toEqual([
            "1",
            "2",
            "3",
          ]);
          expect(request.getArrayLegacy("ids")).toEqual(["[1", "2", "3]"]);
        });
      });

      describe("#getString", () => {
        it("extracts the required parameter", () => {
          expect(request.getString("fullname")).toBe(
            request.input.args.fullname,
          );
        });

        it("should throw if the parameter is missing", () => {
          throws(() => request.getString("childhood"), {
            id: "api.assert.missing_argument",
          });
        });

        it("should return the default value if provided, when the parameter is missing", () => {
          expect(request.getString("childhood", "foo")).toBe("foo");
        });

        it("should throw if the parameter is not a string", () => {
          throws(() => request.getString("age"), {
            id: "api.assert.invalid_type",
          });
        });
      });

      describe("#getObject", () => {
        beforeEach(() => {
          request.context.connection.protocol = "http";
        });

        it("extracts the required parameter", () => {
          expect(request.getObject("relatives")).toBe(
            request.input.args.relatives,
          );
        });

        it("should throw if the parameter is missing", () => {
          throws(() => request.getObject("childhood"), {
            id: "api.assert.missing_argument",
          });
        });

        it("should return the default value if provided, when the parameter is missing", () => {
          const def = { foo: "bar" };

          expect(request.getObject("childhood", def)).toBe(def);
        });

        it("should throw if the parameter is not an object", () => {
          throws(() => request.getObject("age"), {
            id: "api.assert.invalid_type",
          });
        });

        it("should try to parse if the value is a string and the protocol is HTTP", () => {
          expect(typeof request.input.args.powers).toBe("string");

          expect(request.getObject("powers")).toEqual({ fire: 666 });

          // The parse is written back onto the request.
          expect(request.input.args.powers).toEqual({ fire: 666 });
        });

        it("should throw if the value is a string but the protocol is not HTTP", () => {
          request.context.connection.protocol = "ws";

          throws(() => request.getObject("powers"), {
            id: "api.assert.invalid_type",
          });
        });

        it("should throw if the parsing of the string fails", () => {
          throws(() => request.getObject("fullname"), {
            id: "api.assert.invalid_type",
          });
        });
      });

      describe("#getDate", () => {
        it("extracts the birthdate in ISO8061 format", () => {
          expect(request.getDate("birthDate")).toBe("2022-04-11T00:00:00.000Z");
        });

        it("extracts the birthdate in custom format", () => {
          expect(request.getDate("birthDateDay", "YYYY-MM-DD")).toBe(
            "2022-04-11",
          );
        });

        it("should throw if the parameter is invalid date regarding custom date", () => {
          throws(() => request.getDate("birthDate", "YYYY-MM-DD"), {
            id: "api.assert.invalid_type",
          });
        });

        it("should throw if the parameter is invalid ISO8601 date", () => {
          throws(() => request.getDate("badDate"), {
            id: "api.assert.invalid_type",
          });
        });

        it("should throw if the parameter is missing", () => {
          throws(() => request.getDate("anotherDate"), {
            id: "api.assert.missing_argument",
          });
        });
      });

      describe("#getTimestamp", () => {
        it("extracts the birthdate in timestamp format", () => {
          expect(request.getTimestamp("birthDateTime")).toBe(1649635200000);
        });

        it("should throw if the parameter is missing", () => {
          throws(() => request.getTimestamp("anotherDate"), {
            id: "api.assert.missing_argument",
          });
        });
      });

      describe("#getNumber", () => {
        it("extracts the required parameter and convert it", () => {
          expect(request.getNumber("age")).toBe(3011.5);
          expect(request.getNumber("year")).toBe(5270);
        });

        it("should throw if the parameter is missing", () => {
          throws(() => request.getNumber("childhood"), {
            id: "api.assert.missing_argument",
          });
        });

        it("should return the default value if provided, when the parameter is missing", () => {
          expect(request.getNumber("childhood", 123)).toBe(123);
        });

        it("should throw if the parameter is not a number", () => {
          throws(() => request.getNumber("fullname"), {
            id: "api.assert.invalid_type",
          });
        });
      });

      describe("#getInteger", () => {
        it("extracts the required parameter and convert it", () => {
          expect(request.getInteger("year")).toBe(5270);
          expect(request.getInteger("defeatedBugsAt")).toBe(11);
        });

        it("should throw if the parameter is missing", () => {
          throws(() => request.getInteger("childhood"), {
            id: "api.assert.missing_argument",
          });
        });

        it("should return the default value if provided, when the parameter is missing", () => {
          expect(request.getInteger("childhood", 123)).toBe(123);
        });

        it("should throw if the parameter is not an integer", () => {
          throws(() => request.getInteger("age"), {
            id: "api.assert.invalid_type",
          });

          throws(() => request.getInteger("fullname"), {
            id: "api.assert.invalid_type",
          });
        });
      });
    });

    describe("#getIndex", () => {
      beforeEach(() => {
        request.input.args = { index: "index" };
      });

      it("should extract an index", () => {
        expect(request.getIndex()).toBe("index");
      });

      it("should throw if the index is missing", () => {
        request.input.args = {};

        throws(() => request.getIndex(), {
          id: "api.assert.missing_argument",
        });
      });
    });

    describe("#getIndexAndCollection", () => {
      beforeEach(() => {
        request.input.args = { collection: "collection", index: "index" };
      });

      it("should extract an index and a collection", () => {
        expect(request.getIndexAndCollection()).toEqual({
          collection: "collection",
          index: "index",
        });
      });

      it("should throw if the index is missing", () => {
        request.input.args = { collection: "collection" };

        throws(() => request.getIndexAndCollection(), {
          id: "api.assert.missing_argument",
          message: 'Missing argument "index".',
        });
      });

      it("should throw if the collection is missing", () => {
        request.input.args = { index: "index" };

        throws(() => request.getIndexAndCollection(), {
          id: "api.assert.missing_argument",
          message: 'Missing argument "collection".',
        });
      });
    });

    describe("#getId", () => {
      beforeEach(() => {
        request.input.args = { _id: "id" };
      });

      it("should extract an id", () => {
        expect(request.getId()).toBe("id");
      });

      it("should throw if the id is missing", () => {
        request.input.args = {};

        throws(() => request.getId(), { id: "api.assert.missing_argument" });
      });

      it("should throw if the id is wrong type", () => {
        request.input.args = { _id: 42 };

        throws(() => request.getId(), { id: "api.assert.invalid_type" });
      });
    });

    describe("#getKuid", () => {
      beforeEach(() => {
        request = new KuzzleRequest({}, { user: invalid({ _id: "id" }) });
      });

      it("should extract an user id", () => {
        expect(request.getKuid()).toBe("id");
      });
    });

    describe("#getSearchParams", () => {
      const input = {
        body: { query: { foo: "bar" } },
        from: 1,
        scroll: "10m",
        searchBody: '{"query":{"foo":"bar"}}',
        size: 11,
      };

      const get = () =>
        new KuzzleRequest(
          { ...input },
          { connection: invalid({ protocol: "http", verb: "GET" }) },
        );

      const post = () =>
        new KuzzleRequest(
          { ...input },
          { connection: invalid({ protocol: "http", verb: "POST" }) },
        );

      it("should extract search params", () => {
        expect(post().getSearchParams()).toMatchObject({
          from: 1,
          query: { foo: "bar" },
          scrollTTL: "10m",
          searchBody: { query: { foo: "bar" } },
          size: 11,
        });
      });

      it("should extract search params when invoking the route with GET", () => {
        request = get();
        request.input.body = null;

        expect(request.getSearchParams()).toMatchObject({
          from: 1,
          query: {},
          scrollTTL: "10m",
          searchBody: { query: { foo: "bar" } },
          size: 11,
        });
      });

      it("should extract searchBody param when the route is invoked using GET", () => {
        request = get();
        request.input.body = null;

        expect(request.getSearchBody()).toEqual({ query: { foo: "bar" } });
      });

      it("should extract searchBody param", () => {
        expect(post().getSearchBody()).toEqual({ query: { foo: "bar" } });
      });

      it("should throw when the route is invoked with GET and invalid search body is provided", () => {
        request = get();
        request.input.body = null;
        request.input.args.searchBody = 0;

        throws(() => request.getSearchBody(), {
          id: "api.assert.invalid_type",
          message: 'Wrong type for argument "searchBody" (expected: object)',
        });
      });

      it("should provide empty body when the route is invoked with GET and no search body is provided", () => {
        request = get();
        request.input.body = null;
        delete request.input.args.searchBody;

        expect(request.getSearchBody()).toEqual({});
      });

      it("should throw when the route is invoked with GET and a null search body is provided", () => {
        /*
         * The Mocha version was named "should return a {} object …" and its
         * body was `should(() => { … })` with no assertion method on the end:
         * the callback was wrapped and never invoked. Running it says why —
         * `null` is not absent, so the default never applies and `getObject`
         * rejects it. The name described a behaviour the subject does not
         * have; whether it should is a `lib/` question, filed not fixed.
         */
        request = get();
        request.input.body = null;
        request.input.args.searchBody = null;

        throws(() => request.getSearchBody(), {
          id: "api.assert.invalid_type",
          message: 'Wrong type for argument "searchBody" (expected: object)',
        });
      });

      it("should have have default value", () => {
        request = new KuzzleRequest(
          {},
          { connection: invalid({ protocol: "http", verb: "POST" }) },
        );

        expect(request.getSearchParams()).toMatchObject({
          from: 0,
          query: {},
          scrollTTL: undefined,
          searchBody: {},
          size: 10,
        });
      });
    });

    describe("#getScrollTTLParam", () => {
      beforeEach(() => {
        request.input.args = { scroll: "10s" };
      });

      it("should extract scroll param", () => {
        expect(request.getScrollTTLParam()).toBe("10s");
      });

      it("should throw if the scroll param is not a string", () => {
        request.input.args.scroll = 32;

        throws(() => request.getScrollTTLParam(), {
          id: "api.assert.invalid_type",
        });
      });
    });

    describe("#getBody", () => {
      it("should throw if the request does not have a body", () => {
        request.input.body = null;

        throws(() => request.getBody(), { id: "api.assert.body_required" });
      });

      it("should return the default value instead of throwing if one is provided", () => {
        request.input.body = null;

        expect(request.getBody(invalid("foo"))).toBe("foo");
      });

      it("should return the request body", () => {
        const body = { foo: "bar" };

        request.input.body = body;

        expect(request.getBody()).toBe(body);
      });
    });
  });

  describe("#pojo", () => {
    it("returns a POJO usable to match with Koncorde", () => {
      const koncorde = new Koncorde();
      const request = new KuzzleRequest({
        _id: "dana",
        action: "create",
        body: { age: 30 },
        collection: "budva",
        controller: "document",
        index: "montenegro",
      });

      const id1 = koncorde.register({
        equals: { "input.args.collection": "budva" },
      });

      expect(koncorde.test(request.pojo())).toEqual([id1]);
    });
  });
});
