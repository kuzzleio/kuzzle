import { describe, expect, it } from "vitest";

import BaseType from "../../../../lib/core/validation/baseType";
import GeoPointType from "../../../../lib/core/validation/types/geoPoint";

describe("#core/validation/types/geoPoint", () => {
  const geoPointType = new GeoPointType();

  it("inherits the BaseType class", () => {
    expect(geoPointType).toBeInstanceOf(BaseType);
  });

  it("constructs properly", () => {
    expect(typeof geoPointType.typeName).toEqual("string");
    expect(typeof geoPointType.allowChildren).toEqual("boolean");
    expect(Array.isArray(geoPointType.allowedTypeOptions)).toBe(true);
    expect(geoPointType.typeName).toEqual("geo_point");
    expect(geoPointType.allowChildren).toBe(false);
  });

  describe("#validate", () => {
    it("returns true if the geoPoint is valid", () => {
      expect(geoPointType.validate({}, { lat: 25.2, lon: 17.3 }, [])).toBe(
        true,
      );
    });

    it("returns false if the geoPoint is not valid", () => {
      const errorMessages: string[] = [];

      expect(
        geoPointType.validate({}, { not: "a geopoint" }, errorMessages),
      ).toBe(false);
      expect(errorMessages).toEqual(["Invalid GeoPoint format"]);
    });
  });
});
