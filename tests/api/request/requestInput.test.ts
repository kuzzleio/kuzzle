import { describe, expect, it } from "vitest";

import { invalid } from "../../helpers/invalid";

import { RequestInput } from "../../../lib/api/request/requestInput";

describe("#RequestInput", () => {
  it("defaults every property to null", () => {
    const input = new RequestInput({});

    expect(input.volatile).toBeNull();
    expect(input.body).toBeNull();
    expect(input.controller).toBeNull();
    expect(input.action).toBeNull();
    expect(input.resource.index).toBeUndefined();
    expect(input.resource.collection).toBeUndefined();
    expect(input.resource._id).toBeUndefined();
    expect(input.args).toBeInstanceOf(Object);
    expect(Object.keys(input.args)).toHaveLength(0);
    expect(input.jwt).toBeNull();
    expect(input.headers).toBeNull();
    // Not null: the setter normalises "not asked for" to undefined, and the
    // getter has always declared `boolean | undefined`. The only reader is a
    // truthiness test in funnel.ts.
    expect(input.triggerEvents).toBeUndefined();
  });

  it("sets triggerEvents only when explicitly true", () => {
    const input = new RequestInput({});

    input.triggerEvents = false;
    expect(input.triggerEvents).toBeUndefined();

    input.triggerEvents = true;
    expect(input.triggerEvents).toBe(true);
  });

  it("should dispatch data correctly across properties", () => {
    const data = {
        volatile: { foo: "bar" },
        body: { some: "content" },
        controller: "controller",
        action: "action",
        index: "index",
        collection: "collection",
        _id: "id",
        foo: "bar",
        bar: "foo",
        headers: { foo: "args.header" },
        jwt: "a jwt token",
      },
      input = new RequestInput(data);

    input.headers = { foo: "input.header" };
    expect(input.volatile).toBe(data.volatile);
    expect(input.body).toBe(data.body);
    expect(input.controller).toEqual("controller");
    expect(input.action).toEqual("action");
    expect(input.jwt).toEqual("a jwt token");
    expect(input.resource.index).toEqual("index");
    expect(input.resource.collection).toEqual("collection");
    expect(input.resource._id).toEqual("id");
    expect(input.args).toEqual({
      foo: "bar",
      bar: "foo",
      headers: { foo: "args.header" },
      _id: "id",
      index: "index",
      collection: "collection",
    });
    expect(input.headers).toMatchObject({ foo: "input.header" });
  });

  it("throws if invalid data is provided", () => {
    expect(() => {
      void new RequestInput(invalid(undefined));
    }).toThrow("Input request data must be a non-null object");
    expect(() => {
      void new RequestInput(invalid(null));
    }).toThrow("Input request data must be a non-null object");
    expect(() => {
      void new RequestInput([]);
    }).toThrow("Input request data must be a non-null object");
    expect(() => {
      void new RequestInput(invalid("abc"));
    }).toThrow("Input request data must be a non-null object");
    expect(() => {
      void new RequestInput(invalid(123));
    }).toThrow("Input request data must be a non-null object");
    expect(() => {
      void new RequestInput(invalid(true));
    }).toThrow("Input request data must be a non-null object");
  });

  it("throws if an invalid data parameter is provided", () => {
    // testing object-only parameters
    ["volatile"].forEach((k) => {
      expect(() => {
        void new RequestInput({ [k]: [] });
      }).toThrow(`Attribute ${k} must be of type "object"`);
      expect(() => {
        void new RequestInput({ [k]: 123 });
      }).toThrow(`Attribute ${k} must be of type "object"`);
      expect(() => {
        void new RequestInput({ [k]: false });
      }).toThrow(`Attribute ${k} must be of type "object"`);
      expect(() => {
        void new RequestInput({ [k]: "foobar" });
      }).toThrow(`Attribute ${k} must be of type "object"`);
    });

    ["body"].forEach((k) => {
      expect(() => {
        void new RequestInput({ [k]: 123 });
      }).toThrow(`Attribute ${k} must be of type "object" or "array"`);
      expect(() => {
        void new RequestInput({ [k]: false });
      }).toThrow(`Attribute ${k} must be of type "object" or "array"`);
      expect(() => {
        void new RequestInput({ [k]: "foobar" });
      }).toThrow(`Attribute ${k} must be of type "object" or "array"`);
    });

    // testing string-only parameters
    ["controller", "action", "jwt"].forEach((k) => {
      expect(() => {
        void new RequestInput({ [k]: [] });
      }).toThrow(`Attribute ${k} must be of type "string"`);
      expect(() => {
        void new RequestInput({ [k]: 123 });
      }).toThrow(`Attribute ${k} must be of type "string"`);
      expect(() => {
        void new RequestInput({ [k]: false });
      }).toThrow(`Attribute ${k} must be of type "string"`);
      expect(() => {
        void new RequestInput({ [k]: {} });
      }).toThrow(`Attribute ${k} must be of type "string"`);
    });
  });

  it("should not overwrite the controller value if it has already been set", () => {
    const input = new RequestInput({});

    input.controller = "foo";

    expect(input.controller).toEqual("foo");

    input.controller = "bar";

    expect(input.controller).toEqual("foo");
  });

  it("should not overwrite the action value if it has already been set", () => {
    const input = new RequestInput({});

    input.action = "foo";

    expect(input.action).toEqual("foo");

    input.action = "bar";

    expect(input.action).toEqual("foo");
  });

  it("accepts both array and object for body property", () => {
    let input = new RequestInput({ body: { some: "content" } });

    expect(input.body).toEqual({ some: "content" });

    input = new RequestInput({ body: [1, 2, 3] });

    expect(input.body).toEqual([1, 2, 3]);
  });
});
