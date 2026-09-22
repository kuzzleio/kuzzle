import { describe, expect, it } from "vitest";

import { QueryTranslator } from "../../../../lib/service/storage/commons/queryTranslator";

describe("#service/storage/QueryTranslator", () => {
  const translator = new QueryTranslator();

  describe("#_translateClause", () => {
    /*
     * One case per clause, as the Mocha spec had — the ten `it`s were the same
     * three lines around a different pair, so the pair is the test and the
     * table says so. `it.each` keeps one test per clause, with the clause name
     * in the report.
     */
    it.each([
      ["equals", { city: "Istanbul" }, { term: { city: "Istanbul" } }],
      [
        "in",
        { city: ["Istanbul", "Tirana"] },
        { terms: { city: ["Istanbul", "Tirana"] } },
      ],
      ["exists", "city", { exists: { field: "city" } }],
      [
        "ids",
        { values: ["aschen", "melis"] },
        { ids: { values: ["aschen", "melis"] } },
      ],
      [
        "missing",
        "city",
        { bool: { must_not: [{ exists: { field: "city" } }] } },
      ],
      [
        "range",
        { age: { gt: 25, gte: 25, lt: 27, lte: 27 } },
        { range: { age: { gt: 25, gte: 25, lt: 27, lte: 27 } } },
      ],
      [
        "geoBoundingBox",
        { location: {} },
        { geo_bounding_box: { location: {} } },
      ],
      ["geoPolygon", { location: {} }, { geo_polygon: { location: {} } }],
      ["geoDistance", { location: {} }, { geo_distance: { location: {} } }],
      [
        "geoDistanceRange",
        { location: {} },
        { geo_distance_range: { location: {} } },
      ],
    ])('translates the clause "%s"', (clause, content, expected) => {
      expect(translator._translateClause(clause, content)).toEqual(expected);
    });
  });

  describe("#_translateOperator", () => {
    it.each([
      ["and", [], { bool: { filter: [] } }],
      ["or", [], { bool: { should: [] } }],
      [
        "not",
        { exists: "city" },
        { bool: { must_not: [{ exists: { field: "city" } }] } },
      ],
    ])('translates the operator "%s"', (operator, operands, expected) => {
      expect(translator._translateOperator(operator, operands)).toEqual(
        expected,
      );
    });
  });

  describe("#translate", () => {
    it("translates a complex filter", () => {
      const filters = {
        and: [{ equals: { city: "Antalya" } }, { not: { exists: "age" } }],
      };

      expect(translator.translate(filters)).toEqual({
        bool: {
          filter: [
            { term: { city: "Antalya" } },
            { bool: { must_not: [{ exists: { field: "age" } }] } },
          ],
        },
      });
    });

    it("translates a simple filter", () => {
      const filters = { equals: { city: "Istanbul" } };

      expect(translator.translate(filters)).toEqual({
        term: { city: "Istanbul" },
      });
    });
  });
});
