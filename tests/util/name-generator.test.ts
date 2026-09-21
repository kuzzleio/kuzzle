import { describe, expect, it } from "vitest";

import { NameGenerator } from "../../lib/util/name-generator";

describe("NameGenerator", () => {
  describe("getRandomName", () => {
    it("returns a random name", () => {
      const name = NameGenerator.getRandomName();

      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
    });
  });

  describe("getRandomAdjective", () => {
    it("returns a random adjective", () => {
      const adj = NameGenerator.getRandomAdjective();

      expect(typeof adj).toBe("string");
      expect(adj.length).toBeGreaterThan(0);
    });
  });

  describe("generateRandomName", () => {
    it("returns a random formatted name without prefix by default", () => {
      const name = NameGenerator.generateRandomName();

      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);

      expect(name).toMatch(/^[a-zA-Z]+-[a-zA-Z]+-[0-9]+$/);
    });

    it("returns a random formatted name with a specified prefix", () => {
      const prefix = "prefix";
      const name = NameGenerator.generateRandomName({ prefix });

      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);

      expect(name).toMatch(
        new RegExp(`^${prefix}-[a-zA-Z]+-[a-zA-Z]+-[0-9]+$`),
      );
    });

    it("returns a random formatted name with a specified random number range", () => {
      const postfixRandRange = { max: 1001, min: 100 };
      const name = NameGenerator.generateRandomName({ postfixRandRange });
      const [minDigits, maxDigits] = [
        postfixRandRange.min.toString().length,
        postfixRandRange.max.toString().length,
      ];

      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);

      expect(name).toMatch(
        new RegExp(`^[a-zA-Z]+-[a-zA-Z]+-[0-9]{${minDigits},${maxDigits}}$`),
      );
    });

    it("returns a random formatted name with a specified separator", () => {
      const separator = "_-_";
      const name = NameGenerator.generateRandomName({ separator });

      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);

      expect(name).toMatch(
        new RegExp(`^[a-zA-Z]+${separator}[a-zA-Z]+${separator}[0-9]+$`),
      );
    });
  });
});
