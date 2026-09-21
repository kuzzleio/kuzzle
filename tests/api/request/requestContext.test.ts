import { beforeEach, describe, expect, it } from "vitest";

import { RequestContext } from "../../../lib/api/request/requestContext";

describe("#RequestContext", () => {
  const args = {
    token: { token: "token" },
    user: { user: "user" },
    connection: {
      id: "connectionId",
      protocol: "protocol",
      ips: ["foo", "bar"],
      foo: "bar",
    },
  };

  let context;

  beforeEach(() => {
    context = new RequestContext(args);
  });

  it("should initialize itself with provided options", () => {
    expect(context.connection.id).toEqual("connectionId");
    expect(context.connection.protocol).toEqual("protocol");
    expect(context.connection.ips).toMatchObject(["foo", "bar"]);
    expect(context.connection.misc.foo).toEqual("bar");
    expect(context.token).toMatchObject({ token: "token" });
    expect(context.user).toMatchObject({ user: "user" });

    // checking deprecated properties, ensuring compatibility
    // with older versions
    expect(context.connectionId).toEqual("connectionId");
    expect(context.protocol).toEqual("protocol");
  });

  it("throws if an invalid argument type is provided", () => {
    // string arguments
    ["connectionId", "protocol"].forEach((k) => {
      expect(() => {
        void new RequestContext({ [k]: {} });
      }).toThrow(`Attribute ${k} must be of type "string"`);
      expect(() => {
        void new RequestContext({ [k]: [] });
      }).toThrow(`Attribute ${k} must be of type "string"`);
      expect(() => {
        void new RequestContext({ [k]: 132 });
      }).toThrow(`Attribute ${k} must be of type "string"`);
      expect(() => {
        void new RequestContext({ [k]: true });
      }).toThrow(`Attribute ${k} must be of type "string"`);
    });

    // object arguments
    ["token", "user"].forEach((k) => {
      expect(() => {
        void new RequestContext({ [k]: "foobar" });
      }).toThrow(`Attribute ${k} must be of type "object"`);
      expect(() => {
        void new RequestContext({ [k]: [] });
      }).toThrow(`Attribute ${k} must be of type "object"`);
      expect(() => {
        void new RequestContext({ [k]: 132 });
      }).toThrow(`Attribute ${k} must be of type "object"`);
      expect(() => {
        void new RequestContext({ [k]: true });
      }).toThrow(`Attribute ${k} must be of type "object"`);
    });

    // string arguments for the connection sub-object
    for (const key of ["id", "protocol"]) {
      for (const val of [{}, [], 123, true, false]) {
        expect(
          () => new RequestContext({ connection: { [key]: val } }),
        ).toThrow(`Attribute connection.${key} must be of type "string"`);
      }
    }

    // invalid IPs arrays
    expect(() => new RequestContext({ connection: { ips: "foobar" } })).toThrow(
      'Attribute connection.ips must be of type "array"',
    );
    expect(
      () => new RequestContext({ connection: { ips: ["foo", 123, {}] } }),
    ).toThrow(
      'Attribute connection.ips must contain only values of type "string"',
    );
  });

  it("serializes properly", () => {
    expect(context.toJSON()).toMatchObject(args);
  });
});
