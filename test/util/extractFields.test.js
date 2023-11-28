"use strict";

const should = require("should");
const extractFields = require("../../lib/util/extractFields");

describe("util/extractFields", () => {
  let document;

  beforeEach(() => {
    document = {
      bar: {
        a: "valueBarA",
        b: "valueBarB",
      },
      foo: "valueFoo",
    };
  });

  it("Should extract fields recursively", () => {
    const result = extractFields(document);

    should(result).match(["bar.a", "bar.b", "foo"]);
  });

  it("Should ignore requested fields", () => {
    const result = extractFields(document, { fieldsToIgnore: ["bar"] });

    should(result).match(["foo"]);
  });

  it("Should extract values when asked to", () => {
    const result = extractFields(document, { alsoExtractValues: true });

    should(result).match([
      { key: "bar.a", value: "valueBarA" },
      { key: "bar.b", value: "valueBarB" },
      { key: "foo", value: "valueFoo" },
    ]);
  });
});
