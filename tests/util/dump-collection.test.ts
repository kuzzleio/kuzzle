import { beforeEach, describe, expect, it } from "vitest";

import {
  extractMappingFields,
  flattenObject,
  pickValues,
} from "../../lib/util/dump-collection";

describe("dump-collection", () => {
  let mapping: Record<string, unknown>;
  let document: Record<string, unknown>;

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

      expect(result).toMatchObject({
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

      expect(result).toMatchObject({
        foo: "keyword",
        bar: "integer",
        "baz.alpha": "date",
        "baz.delta": "constant_keyword",
        "baz.nested.deep": "integer",
      });
    });
  });

  describe("#pickValues", () => {
    it("extracts the values from the document given a list of fields", () => {
      const fields = Object.keys(flattenObject(extractMappingFields(mapping)));

      const values = pickValues(document, fields);

      expect(values).toMatchObject(["test", 42, 1649855989915, "debug", 666]);
    });
  });
});
