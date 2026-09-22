import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { KuzzleRequest, RequestResponse } from "../../../lib/api/request";
import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { invalid } from "../../helpers/invalid";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

const nodeId = "knode-nasty-author-4242";

describe("#api/request/RequestResponse", () => {
  let request: KuzzleRequest;
  let response: RequestResponse;

  beforeEach(() => {
    /* The one thing a response reads off the application: which node answered,
     * for the `X-Kuzzle-Node` header and the `node` property. */
    stubKuzzle({ id: nodeId });

    request = new KuzzleRequest({
      index: "index",
      collection: "collection",
      controller: "controller",
      action: "action",
    });
    response = new RequestResponse(request);
  });

  afterEach(() => {
    restoreKuzzle();
  });

  describe("#constructor", () => {
    it("should populate a valid response object", () => {
      expect(response.status).toBe(request.status);
      expect(response.error).toBe(request.error);
      expect(response.requestId).toBe(request.id);
      expect(response.controller).toBe(request.input.controller);
      expect(response.action).toBe(request.input.action);
      expect(response.collection).toBe(request.input.args.collection);
      expect(response.index).toBe(request.input.args.index);
      expect(response.volatile).toBe(request.input.volatile);
      expect(response.headers).toMatchObject({ "X-Kuzzle-Node": nodeId });
      expect(response.result).toBe(request.result);
      expect(response.node).toBe(nodeId);
      expect(response.deprecations).toBeUndefined();
    });

    it("should refuse to be extended", () => {
      expect(() => {
        (response as unknown as Record<string, string>).foo = "bar";
      }).toThrow(TypeError);
    });
  });

  describe("#properties", () => {
    it("should set the request status", () => {
      response.status = 666;

      expect(request.status).toBe(666);
    });

    it("should set the request error, and its status with it", () => {
      const error = new BadRequestError("test");

      response.error = error;

      expect(request.error).toBe(error);
      expect(request.status).toBe(error.status);
    });

    it("should set the request result", () => {
      const result = { foo: "bar" };

      response.result = result;

      expect(request.result).toBe(result);
    });

    // This setter assigns through to `KuzzleRequest.deprecations`, which had a
    // getter and no setter — in a module, which is strict mode, that throws a
    // TypeError. Nothing exercised it, so the throw was never seen.
    it("should set the request deprecations", () => {
      const deprecations = [{ message: "deprecated", version: "2.0.0" }];

      response.deprecations = deprecations;

      expect(request.deprecations).toBe(deprecations);
      expect(response.deprecations).toBe(deprecations);
    });
  });

  describe("#setHeader", () => {
    it("should set headers without changing their names", () => {
      response.setHeader("X-Foo", "Bar");
      response.setHeader("X-Bar", "Baz");

      expect(response.headers).toMatchObject({
        "X-Foo": "Bar",
        "X-Bar": "Baz",
      });
    });

    it("should store cookies in an array", () => {
      response.setHeader("Set-Cookie", "test");
      expect(response.headers["Set-Cookie"]).toEqual(["test"]);

      response.setHeader("Set-Cookie", "test2");
      expect(response.headers["Set-Cookie"]).toEqual(["test", "test2"]);
    });

    it.each([
      "age",
      "authorization",
      "content-length",
      "content-type",
      "etag",
      "expires",
      "from",
      "host",
      "if-modified-since",
      "if-unmodified-since",
      "last-modified, location",
      "max-forwards",
      "proxy-authorization",
      "referer",
      "retry-after",
      "user-agent",
    ])("should overwrite the common HTTP header %s", (name) => {
      for (let i = 0; i < 10; i++) {
        response.setHeader(name, `foobar${i}`);
      }

      expect(response.headers[name]).toBe("foobar9");
    });

    it.each(["Content-Length", "X-Foo", "Set-Cookie"])(
      "should not duplicate the key of %s",
      (name) => {
        response.setHeader(name, "foo");
        response.setHeader(name.toLowerCase(), "bar");
        response.setHeader(name.toUpperCase(), "baz");

        expect(response.headers).toHaveProperty(name);
        expect(Object.keys(response.headers)).not.toContain(
          name.toLowerCase() === name ? name.toUpperCase() : name.toLowerCase(),
        );
      },
    );

    it("should add values to an existing regular header", () => {
      response.setHeader("X-Baz", "Foo");
      response.setHeader("X-Baz", "Bar");

      expect(response.headers["X-Baz"]).toBe("Foo, Bar");
    });

    it.each([{}, 1.42, true, []])(
      "should throw on the non-string header name %s",
      (name) => {
        expect(() => response.setHeader(invalid<string>(name), "test")).toThrow(
          BadRequestError,
        );
      },
    );

    it.each([null, undefined])(
      "should do nothing for the header name %s",
      (name) => {
        expect(() =>
          response.setHeader(invalid<string>(name), "foo"),
        ).not.toThrow();
        expect(response.headers).toMatchObject({ "X-Kuzzle-Node": nodeId });
      },
    );

    it.each([{ foo: "bar" }, 1.42, true, ["baz", true, null], null, undefined])(
      "should stringify the value %s",
      (value) => {
        response.setHeader("test", invalid<string>(value));

        expect(response.headers.test).toBe(String(value));
      },
    );

    it("should merge duplicates injected directly into the headers object", () => {
      response.headers.oh = "noes11!1";
      response.headers.OH = "NOES!!1!";

      expect(response.headers.oh).toBe("noes11!1, NOES!!1!");
      expect(response.headers.OH).toBe("noes11!1, NOES!!1!");

      const asPojo = JSON.parse(JSON.stringify(response.headers));

      expect(asPojo.oh).toBe("noes11!1, NOES!!1!");
      expect(asPojo.OH).toBeUndefined();
    });
  });

  describe("#setHeaders", () => {
    it("should add to the existing headers", () => {
      response.setHeader("X-Foo", "foo");
      response.setHeader("test", "test");

      response.setHeaders({ test: "test", banana: "42" });

      expect(response.headers).toHaveProperty("X-Foo");
      expect(response.headers).toHaveProperty("test", "test, test");
      expect(response.headers).toHaveProperty("banana", "42");
    });

    it("should keep the existing value when told not to overwrite", () => {
      response.setHeader("X-Foo", "foo");
      response.setHeader("test", "test");

      response.setHeaders({ test: "foobar", banana: "42" }, true);

      expect(response.headers).toHaveProperty("X-Foo");
      expect(response.headers).toHaveProperty("test", "test");
      expect(response.headers).toHaveProperty("banana", "42");
    });

    it("should do nothing when given nothing", () => {
      response.setHeaders(invalid<Record<string, string>>(null));

      expect(response.headers).toMatchObject({ "X-Kuzzle-Node": nodeId });
    });
  });

  describe("#removeHeader / #getHeader", () => {
    beforeEach(() => {
      response.setHeader("X-Foo", "foo");
      response.setHeader("X-Bar", "bar");
    });

    it.each(["X-Foo", "x-fOO"])("should remove %s", (name) => {
      response.removeHeader(name);

      expect(response.headers).not.toHaveProperty("X-Foo");
      expect(response.headers).toHaveProperty("X-Bar", "bar");
    });

    it.each(["X-Foo", "x-fOO"])("should fetch %s", (name) => {
      expect(response.getHeader(name)).toBe("foo");
    });
  });

  describe("#configure", () => {
    it("should configure the headers", () => {
      response.configure({ headers: { "X-Foo": "foo" } });

      expect(response.getHeader("X-Foo")).toBe("foo");
    });

    it("should configure the status", () => {
      response.configure({ status: 402 });

      expect(response.status).toBe(402);
    });

    it("should configure the format", () => {
      response.configure({ format: "raw" });
      expect(response.raw).toBe(true);

      response.configure({ format: "standard" });
      expect(response.raw).toBe(false);
    });
  });

  describe("#toJSON", () => {
    it("should return a valid JSON object in Kuzzle format", () => {
      const json = response.toJSON();

      expect(Object.keys(json)).toEqual(
        expect.arrayContaining([
          "raw",
          "status",
          "requestId",
          "content",
          "headers",
        ]),
      );
      expect(Object.keys(json.content)).toEqual(
        expect.arrayContaining([
          "error",
          "requestId",
          "controller",
          "action",
          "collection",
          "index",
          "volatile",
          "result",
          "deprecations",
          "headers",
        ]),
      );
      expect(json.raw).toBe(false);
    });

    it("should only include the headers added through configure() in the content", () => {
      response.configure({
        headers: { "x-foo": "bar", "set-cookie": "cookie" },
      });
      response.setHeader("x-bar", "baz");

      expect(response.toJSON().content.headers).toMatchObject({
        "x-foo": "bar",
      });
      // The key is there, with no value: `content.headers` is built by
      // deleting the cookies from a copy of the header object.
      expect(response.toJSON().content.headers["set-cookie"]).toBeUndefined();

      expect(response.toJSON().headers).toMatchObject({
        "x-foo": "bar",
        "set-cookie": ["cookie"],
        "x-bar": "baz",
      });
    });

    it("should return a valid JSON object in raw format", () => {
      response.raw = true;
      response.setHeader("x-foo", "bar");
      response.setHeader("set-cookie", "cookie");
      response.result = "foobar";
      response.status = 666;

      const json = response.toJSON();

      expect(json.raw).toBe(true);
      expect(json.status).toBe(666);
      expect(json.content).toBe("foobar");
      expect(json.headers).toMatchObject({
        "x-foo": "bar",
        "set-cookie": ["cookie"],
      });
    });
  });
});
