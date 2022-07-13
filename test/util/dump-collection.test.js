"use strict";

const should = require("should");
const {
  extractMappingFields,
  flattenObject,
  pickValues,
} = require("../../lib/util/dump-collection");

describe("dump-collection", () => {
  let mapping;
  let document;

  beforeEach(() => {
    mapping = {
      properties: {
        foo: {
          type: "keyword",
        },
        bar: {
          type: "integer",
        },
        baz: {
          properties: {
            alpha: {
              type: "date",
            },
            delta: {
              type: "constant_keyword",
              value: "debug",
            },
            nested: {
              properties: {
                deep: {
                  type: "integer",
                },
              },
            },
          },
        },
      },
    };

    document = {
      foo: "test",
      bar: 42,
      baz: {
        alpha: 1649855989915,
        delta: "debug",
        nested: {
          deep: 666,
        },
      },
    };
  });

  describe("#extractMappingFields", () => {
    it("Should extract fields from mapping recursively", () => {
      const result = extractMappingFields(mapping);

      should(result).match({
        foo: "keyword",
        bar: "integer",
        baz: {
          alpha: "date",
          delta: "constant_keyword",
          nested: {
            deep: "integer",
          },
        },
      });
    });
  });

  describe("#flattenObject", () => {
    it("Should flatten the map properties", () => {
      const result = flattenObject(extractMappingFields(mapping));

      should(result).match({
        foo: "keyword",
        bar: "integer",
        "baz.alpha": "date",
        "baz.delta": "constant_keyword",
        "baz.nested.deep": "integer",
      });
    });
  });

  describe("#pickValues", () => {
    it("should extact the values from the document given a list of fields", () => {
      const fields = Object.keys(flattenObject(extractMappingFields(mapping)));

      const values = pickValues(document, fields);

      should(values).match(["test", 42, 1649855989915, "debug", 666]);
    });
  });
});
