import { beforeEach, describe, expect, it } from "vitest";

import extractFields from "../../lib/util/extractFields";

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

    expect(result).toMatchObject(["bar.a", "bar.b", "foo"]);
  });

  it("Should ignore requested fields", () => {
    const result = extractFields(document, { fieldsToIgnore: ["bar"] });

    expect(result).toMatchObject(["foo"]);
  });

  it("Should extract values when asked to", () => {
    const result = extractFields(document, { alsoExtractValues: true });

    expect(result).toMatchObject([
      { key: "bar.a", value: "valueBarA" },
      { key: "bar.b", value: "valueBarB" },
      { key: "foo", value: "valueFoo" },
    ]);
  });
});
