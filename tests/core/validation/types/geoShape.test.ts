import { beforeEach, describe, expect, it, vi } from "vitest";

import GeoShapeType from "../../../../lib/core/validation/types/geoShape";
import { PreconditionError } from "../../../../lib/kerror/errors/preconditionError";
import { invalid } from "../../../helpers/invalid";

/**
 * ⚠️ The Mocha spec replaced the coordinate predicates — `isPoint`, `isLine`,
 * `isPolygon`, `isEnvelope` — inside the module that calls them, sixty times,
 * and then fed the subject `coordinates: ["some coordinates"]`. So the shapes
 * it validated were not shapes, and what it asserted was **delegation**: that
 * validating a point calls `isPoint` once.
 *
 * The predicates are pure functions of a few numbers ([their own
 * spec](./geoShapeUtils.test.ts) covers them). Given real coordinates they run
 * for free, which is why nothing is replaced here and every case below is a
 * shape a user could actually send.
 */
describe("#core/validation/types/GeoShapeType", () => {
  let geoShape: GeoShapeType;
  let errorMessages: string[];

  /** A valid pair, a valid line, a closed part, so each case reads as itself. */
  const point = [10, 20];
  const line = [
    [0, 0],
    [10, 10],
  ];
  const polygonPart = [
    [0, 0],
    [0, 10],
    [10, 10],
    [0, 0],
  ];

  const validate = (allowedShapes: string[], shape: unknown) =>
    geoShape.recursiveShapeValidation(
      allowedShapes,
      invalid(shape),
      errorMessages,
    );

  beforeEach(() => {
    geoShape = new GeoShapeType();
    errorMessages = [];
  });

  describe("#validate", () => {
    it("should validate the value against the shapes the field allows", () => {
      const recurse = vi
        .spyOn(geoShape, "recursiveShapeValidation")
        .mockReturnValue(true);

      geoShape.validate(
        { shapeTypes: ["point"] },
        invalid({ coordinates: point, type: "point" }),
        errorMessages,
      );

      expect(recurse).toHaveBeenCalledExactlyOnceWith(
        ["point"],
        { coordinates: point, type: "point" },
        errorMessages,
      );
    });

    /* `shapeTypes` is optional on the type options, and an absent one means
     * "no shape allowed" rather than "every shape" — nothing said so. */
    it("should allow no shape at all when the field specifies none", () => {
      expect(
        geoShape.validate(
          {},
          invalid({ coordinates: point, type: "point" }),
          errorMessages,
        ),
      ).toBe(false);
      expect(errorMessages).toEqual([
        "The provided shape type is not allowed.",
      ]);
    });
  });

  describe("#recursiveShapeValidation", () => {
    it("should refuse a shape whose structure is invalid, without adding to the report", () => {
      vi.spyOn(geoShape, "checkStructure").mockReturnValue(false);

      expect(validate(["allowed"], { coordinates: point, type: "point" })).toBe(
        false,
      );
      /* `checkStructure` is what reports its own refusal; this path adds
       * nothing on top. */
      expect(errorMessages).toEqual([]);
    });

    it.each([
      ["point", { coordinates: point, type: "point" }],
      ["linestring", { coordinates: line, type: "linestring" }],
      ["polygon", { coordinates: [polygonPart], type: "polygon" }],
      [
        "multipoint",
        {
          coordinates: [point, [30, 40]],
          type: "multipoint",
        },
      ],
      [
        "multilinestring",
        { coordinates: [line, line], type: "multilinestring" },
      ],
      [
        "multipolygon",
        { coordinates: [[polygonPart], [polygonPart]], type: "multipolygon" },
      ],
      [
        "envelope",
        {
          coordinates: [
            [0, 10],
            [10, 0],
          ],
          type: "envelope",
        },
      ],
      ["circle", { coordinates: point, radius: "10m", type: "circle" }],
      [
        "geometrycollection",
        {
          geometries: [{ coordinates: point, type: "point" }],
          type: "geometrycollection",
        },
      ],
    ])("should accept a valid %s", (type, shape) => {
      expect(validate([type, "point"], shape)).toBe(true);
      expect(errorMessages).toEqual([]);
    });

    it.each([
      ["point", { coordinates: [190, 20], type: "point" }],
      ["linestring", { coordinates: [point], type: "linestring" }],
      ["polygon", { coordinates: [line], type: "polygon" }],
      ["envelope", { coordinates: [point], type: "envelope" }],
    ])("should refuse a %s with bad coordinates", (type, shape) => {
      expect(validate([type], shape)).toBe(false);
      expect(errorMessages).toEqual([
        `The shape type "${type}" has bad coordinates.`,
      ]);
    });

    /* ⚠️ A multi-shape reports a different message, and it carries a double
     * space: "One of the shapes in  the shape type …". Pinned as it ships —
     * no Mocha test ever reached this branch, because every multi-shape case
     * there had its predicate stubbed to answer true. */
    it.each(["multipoint", "multilinestring", "multipolygon"])(
      "should refuse a %s holding a bad shape",
      (type) => {
        expect(
          validate([type], { coordinates: [point, [190, 20]], type }),
        ).toBe(false);
        expect(errorMessages).toEqual([
          `One of the shapes in  the shape type "${type}" has bad coordinates.`,
        ]);
      },
    );

    it("should accept the orientations Elasticsearch accepts", () => {
      for (const orientation of [
        "right",
        "ccw",
        "counterclockwise",
        "left",
        "cw",
        "clockwise",
      ]) {
        expect(
          validate(["polygon"], {
            coordinates: [polygonPart],
            orientation,
            type: "polygon",
          }),
        ).toBe(true);
      }

      expect(errorMessages).toEqual([]);
    });

    it("should refuse an orientation that is not one of them", () => {
      expect(
        validate(["polygon"], {
          coordinates: [polygonPart],
          orientation: "bad orientation",
          type: "polygon",
        }),
      ).toBe(false);
      expect(errorMessages).toEqual([
        "The orientation property has not a valid value.",
      ]);
    });

    it("should refuse a geometry collection holding an invalid geometry", () => {
      expect(
        validate(["geometrycollection", "point"], {
          geometries: [{ coordinates: [190, 20], type: "point" }],
          type: "geometrycollection",
        }),
      ).toBe(false);
      expect(errorMessages).toEqual([
        'The shape type "point" has bad coordinates.',
      ]);
    });

    it.each([
      ["a number", 10],
      ["a distance string", "10m"],
      ["a distance with a space", "10 km"],
    ])("should accept a circle whose radius is %s", (_name, radius) => {
      expect(
        validate(["circle"], { coordinates: point, radius, type: "circle" }),
      ).toBe(true);
    });

    it.each([
      ["an object", { not: "valid" }],
      ["an unparseable string", "not a distance"],
      ["a boolean", true],
    ])("should refuse a circle whose radius is %s", (_name, radius) => {
      expect(
        validate(["circle"], { coordinates: point, radius, type: "circle" }),
      ).toBe(false);
      expect(errorMessages).toEqual([
        "The radius property has not a valid format.",
      ]);
    });
  });

  describe("#checkStructure", () => {
    const check = (allowedShapes: string[], shape: unknown) =>
      geoShape.checkStructure(allowedShapes, invalid(shape), errorMessages);

    it("should accept a shape of an allowed type with its coordinates", () => {
      expect(check(["point"], { coordinates: point, type: "point" })).toBe(
        true,
      );
      expect(errorMessages).toEqual([]);
    });

    it.each([
      [
        "no type at all",
        ["point"],
        { coordinates: point },
        "The shape object has no type defined.",
      ],
      [
        "a property that is not allowed",
        ["point"],
        { coordinates: point, invalid: "property", type: "point" },
        "The shape object has a not allowed property.",
      ],
      [
        "a type the field does not allow",
        ["point"],
        { coordinates: point, radius: 10, type: "circle" },
        "The provided shape type is not allowed.",
      ],
      [
        "coordinates on a geometry collection",
        ["geometrycollection"],
        {
          coordinates: point,
          geometries: [{ coordinates: point, type: "point" }],
          type: "geometrycollection",
        },
        'The coordinates property must not be provided for the "geometrycollection" shape type.',
      ],
      [
        "coordinates that are not an array",
        ["point"],
        { coordinates: "not coordinates", type: "point" },
        'The coordinates property must be provided for the "point" shape type.',
      ],
      [
        "a circle with no radius",
        ["circle"],
        { coordinates: point, type: "circle" },
        'The radius property is mandatory for the "circle" shape type.',
      ],
      [
        "a radius outside a circle",
        ["point"],
        { coordinates: point, radius: "10m", type: "point" },
        'The radius property must not be provided for the "point" shape type.',
      ],
      [
        "an orientation outside a polygon",
        ["point"],
        { coordinates: point, orientation: "right", type: "point" },
        'The orientation property must not be provided for the "point" shape type.',
      ],
      [
        "geometries outside a geometry collection",
        ["point"],
        { coordinates: point, geometries: [], type: "point" },
        'The geometries property must not be provided for the "point" shape type.',
      ],
      [
        "a geometry collection whose geometries are not an array",
        ["geometrycollection"],
        { geometries: "not an array", type: "geometrycollection" },
        'The geometries property must be provided for the "geometrycollection" shape type.',
      ],
    ])("should refuse %s", (_name, allowedShapes, shape, message) => {
      expect(check(allowedShapes, shape)).toBe(false);
      expect(errorMessages).toEqual([message]);
    });
  });

  describe("#validateFieldSpecification", () => {
    it("should allow every shape when the specification names none", () => {
      expect(geoShape.validateFieldSpecification({})).toEqual({
        shapeTypes: [
          "point",
          "linestring",
          "polygon",
          "multipoint",
          "multilinestring",
          "multipolygon",
          "geometrycollection",
          "envelope",
          "circle",
        ],
      });
    });

    it("should keep the shapes the specification names", () => {
      expect(
        geoShape.validateFieldSpecification({
          shapeTypes: ["point", "linestring"],
        }),
      ).toEqual({ shapeTypes: ["point", "linestring"] });
    });

    it("should refuse a shape type it does not know", () => {
      expect(() =>
        geoShape.validateFieldSpecification({
          shapeTypes: ["circle", "multipolygon", "invalid"],
        }),
      ).toThrow(
        expect.objectContaining({ id: "validation.types.invalid_geoshape" }),
      );
      expect(() =>
        geoShape.validateFieldSpecification({
          shapeTypes: ["invalid", "circle", "foo", "multipolygon", "bar"],
        }),
      ).toThrow(PreconditionError);
    });

    it.each([[[]], [null], [undefined], ["foo"], [123]])(
      "should refuse %s as a list of shapes",
      (shapeTypes) => {
        expect(() =>
          geoShape.validateFieldSpecification(invalid({ shapeTypes })),
        ).toThrow(
          expect.objectContaining({ id: "validation.assert.invalid_type" }),
        );
      },
    );
  });
});
