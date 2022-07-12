"use strict";

const should = require("should");
const { RequestContext } = require("../../../lib/api/request/requestContext");

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
    should(context.connection.id).eql("connectionId");
    should(context.connection.protocol).eql("protocol");
    should(context.connection.ips).match(["foo", "bar"]);
    should(context.connection.misc.foo).eql("bar");
    should(context.token).match({ token: "token" });
    should(context.user).match({ user: "user" });

    // checking deprecated properties, ensuring compatibility
    // with older versions
    should(context.connectionId).eql("connectionId");
    should(context.protocol).eql("protocol");
  });

  it("should throw if an invalid argument type is provided", () => {
    // string arguments
    ["connectionId", "protocol"].forEach((k) => {
      should(function () {
        new RequestContext({ [k]: {} });
      }).throw(`Attribute ${k} must be of type "string"`);
      should(function () {
        new RequestContext({ [k]: [] });
      }).throw(`Attribute ${k} must be of type "string"`);
      should(function () {
        new RequestContext({ [k]: 132 });
      }).throw(`Attribute ${k} must be of type "string"`);
      should(function () {
        new RequestContext({ [k]: true });
      }).throw(`Attribute ${k} must be of type "string"`);
    });

    // object arguments
    ["token", "user"].forEach((k) => {
      should(function () {
        new RequestContext({ [k]: "foobar" });
      }).throw(`Attribute ${k} must be of type "object"`);
      should(function () {
        new RequestContext({ [k]: [] });
      }).throw(`Attribute ${k} must be of type "object"`);
      should(function () {
        new RequestContext({ [k]: 132 });
      }).throw(`Attribute ${k} must be of type "object"`);
      should(function () {
        new RequestContext({ [k]: true });
      }).throw(`Attribute ${k} must be of type "object"`);
    });

    // string arguments for the connection sub-object
    for (const key of ["id", "protocol"]) {
      for (const val of [{}, [], 123, true, false]) {
        should(() => new RequestContext({ connection: { [key]: val } })).throw(
          `Attribute connection.${key} must be of type "string"`
        );
      }
    }

    // invalid IPs arrays
    should(() => new RequestContext({ connection: { ips: "foobar" } })).throw(
      'Attribute connection.ips must be of type "array"'
    );
    should(
      () => new RequestContext({ connection: { ips: ["foo", 123, {}] } })
    ).throw(
      'Attribute connection.ips must contain only values of type "string"'
    );
  });

  it("should serialize properly", () => {
    should(context.toJSON()).match(args);
  });
});
