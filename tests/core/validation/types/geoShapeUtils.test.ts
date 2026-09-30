import { describe, expect, it } from "vitest";

import {
  isEnvelope,
  isLine,
  isPoint,
  isPointEqual,
  isPolygon,
  isPolygonPart,
} from "../../../../lib/core/validation/types/geoShapeUtils";

/**
 * ⚠️ The Mocha spec tested these six by stubbing each other — `isLine` with
 * `isPoint` replaced, `isPolygonPart` with `isLine` and `isPointEqual`
 * replaced — on fixtures like `["one", "two", "three", "four"]`, which are not
 * coordinates at all. What it asserted was the *call count* of the
 * replacement: that `isLine` calls something twice for a two-element list.
 *
 * They are pure functions of a few numbers. Fed real coordinates they need no
 * stubbing, the fixtures say what a shape is, and the nesting — a polygon part
 * is a closed line of at least four points, a line is at least two points —
 * is asserted rather than assumed.
 */
describe("#core/validation/types/geoShapeUtils", () => {
  const point = [10, 20];

  describe("#isPoint", () => {
    it("should accept a longitude/latitude pair", () => {
      expect(isPoint(point)).toBe(true);
      expect(isPoint([-180, -90])).toBe(true);
      expect(isPoint([180, 90])).toBe(true);
    });

    it("should refuse anything that is not a pair", () => {
      expect(isPoint("not a point")).toBe(false);
      expect(isPoint([10])).toBe(false);
      expect(isPoint([10, 20, 30])).toBe(false);
    });

    it("should refuse a point outside the earth", () => {
      expect(isPoint([190, 20])).toBe(false);
      expect(isPoint([-190, 20])).toBe(false);
      expect(isPoint([20, 100])).toBe(false);
      expect(isPoint([20, -100])).toBe(false);
    });
  });

  describe("#isPointEqual", () => {
    it("should compare both coordinates", () => {
      expect(isPointEqual([10, 20], [10, 20])).toBe(true);
      expect(isPointEqual([10, 20], [20, 30])).toBe(false);
      /* One coordinate in common is not equality — the closing point of a
       * polygon part is compared with this. */
      expect(isPointEqual([10, 20], [10, 30])).toBe(false);
    });
  });

  describe("#isLine", () => {
    it("should accept two points or more", () => {
      expect(isLine([point, [30, 40]])).toBe(true);
      expect(isLine([point, [30, 40], [50, 60]])).toBe(true);
    });

    it("should refuse fewer than two points", () => {
      expect(isLine([point])).toBe(false);
      expect(isLine("not a line")).toBe(false);
    });

    it("should refuse a line holding something that is not a point", () => {
      expect(isLine([point, [300, 40]])).toBe(false);
      expect(isLine([point, "not a point"])).toBe(false);
    });
  });

  describe("#isPolygonPart", () => {
    const closed = [
      [0, 0],
      [0, 10],
      [10, 10],
      [0, 0],
    ];

    it("should accept a closed line of at least four points", () => {
      expect(isPolygonPart(closed)).toBe(true);
    });

    it("should refuse anything that is not an array", () => {
      expect(isPolygonPart("not an array")).toBe(false);
    });

    it("should refuse a part that is not a line", () => {
      expect(isPolygonPart([[0, 0], [0, 10], "not a point", [0, 0]])).toBe(
        false,
      );
    });

    it("should refuse a part that does not close on itself", () => {
      expect(
        isPolygonPart([
          [0, 0],
          [0, 10],
          [10, 10],
          [10, 0],
        ]),
      ).toBe(false);
    });

    it("should refuse fewer than four points", () => {
      expect(
        isPolygonPart([
          [0, 0],
          [0, 10],
          [0, 0],
        ]),
      ).toBe(false);
    });
  });

  describe("#isPolygon", () => {
    const part = [
      [0, 0],
      [0, 10],
      [10, 10],
      [0, 0],
    ];

    it("should accept a list of polygon parts", () => {
      expect(isPolygon([part, part])).toBe(true);
    });

    it("should refuse a list holding something that is not a part", () => {
      expect(isPolygon([part, [[0, 0]]])).toBe(false);
    });

    it("should refuse anything that is not an array", () => {
      expect(isPolygon("not an array")).toBe(false);
    });
  });

  describe("#isEnvelope", () => {
    it("should accept two points", () => {
      expect(
        isEnvelope([
          [0, 10],
          [10, 0],
        ]),
      ).toBe(true);
    });

    it("should refuse anything but two points", () => {
      expect(isEnvelope([[0, 10]])).toBe(false);
      expect(isEnvelope("not an envelope")).toBe(false);
      expect(
        isEnvelope([
          [0, 10],
          [10, 0],
          [5, 5],
        ]),
      ).toBe(false);
    });

    it("should refuse an envelope holding something that is not a point", () => {
      expect(isEnvelope([[0, 10], "not a point"])).toBe(false);
    });
  });
});
