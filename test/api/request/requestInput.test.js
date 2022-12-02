"use strict";

const should = require("should");
const { RequestInput } = require("../../../lib/api/request/requestInput");

describe("#RequestInput", () => {
  it("should defaults to null all properties", () => {
    let input = new RequestInput({});

    should(input.volatile).be.null();
    should(input.body).be.null();
    should(input.controller).be.null();
    should(input.action).be.null();
    should(input.resource.index).be.undefined();
    should(input.resource.collection).be.undefined();
    should(input.resource._id).be.undefined();
    should(input.args).be.an.Object().and.be.empty();
    should(input.jwt).be.null();
    should(input.headers).be.null();
  });

  it("should dispatch data correctly across properties", () => {
    let data = {
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
    should(input.volatile).be.exactly(data.volatile);
    should(input.body).be.exactly(data.body);
    should(input.controller).eql("controller");
    should(input.action).eql("action");
    should(input.jwt).eql("a jwt token");
    should(input.resource.index).eql("index");
    should(input.resource.collection).eql("collection");
    should(input.resource._id).eql("id");
    should(input.args).deepEqual({
      foo: "bar",
      bar: "foo",
      headers: { foo: "args.header" },
      _id: "id",
      index: "index",
      collection: "collection",
    });
    should(input.headers).match({ foo: "input.header" });
  });

  it("should throw if invalid data is provided", () => {
    should(function () {
      new RequestInput();
    }).throw("Input request data must be a non-null object");
    should(function () {
      new RequestInput(null);
    }).throw("Input request data must be a non-null object");
    should(function () {
      new RequestInput([]);
    }).throw("Input request data must be a non-null object");
    should(function () {
      new RequestInput("abc");
    }).throw("Input request data must be a non-null object");
    should(function () {
      new RequestInput(123);
    }).throw("Input request data must be a non-null object");
    should(function () {
      new RequestInput(true);
    }).throw("Input request data must be a non-null object");
  });

  it("should throw if an invalid data parameter is provided", () => {
    // testing object-only parameters
    ["volatile"].forEach((k) => {
      should(function () {
        new RequestInput({ [k]: [] });
      }).throw(`Attribute ${k} must be of type "object"`);
      should(function () {
        new RequestInput({ [k]: 123 });
      }).throw(`Attribute ${k} must be of type "object"`);
      should(function () {
        new RequestInput({ [k]: false });
      }).throw(`Attribute ${k} must be of type "object"`);
      should(function () {
        new RequestInput({ [k]: "foobar" });
      }).throw(`Attribute ${k} must be of type "object"`);
    });

    // testing string-only parameters
    ["controller", "action", "jwt"].forEach((k) => {
      should(function () {
        new RequestInput({ [k]: [] });
      }).throw(`Attribute ${k} must be of type "string"`);
      should(function () {
        new RequestInput({ [k]: 123 });
      }).throw(`Attribute ${k} must be of type "string"`);
      should(function () {
        new RequestInput({ [k]: false });
      }).throw(`Attribute ${k} must be of type "string"`);
      should(function () {
        new RequestInput({ [k]: {} });
      }).throw(`Attribute ${k} must be of type "string"`);
    });
  });

  it("should not overwrite the controller value if it has already been set", () => {
    let input = new RequestInput({});

    input.controller = "foo";

    should(input.controller).eql("foo");

    input.controller = "bar";

    should(input.controller).eql("foo");
  });

  it("should not overwrite the action value if it has already been set", () => {
    let input = new RequestInput({});

    input.action = "foo";

    should(input.action).eql("foo");

    input.action = "bar";

    should(input.action).eql("foo");
  });
});
