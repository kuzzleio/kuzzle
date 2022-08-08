"use strict";

const should = require("should");

const { NameGenerator } = require("../../lib/util/name-generator");

describe("NameGenerator", () => {
  describe("getRandomName", () => {
    it("should return a random name", () => {
      const name = NameGenerator.getRandomName();

      should(name).be.a.String();
      should(name).not.be.empty();
    });
  });

  describe("getRandomAdjective", () => {
    it("should return a random adjective", () => {
      const adj = NameGenerator.getRandomAdjective();

      should(adj).be.a.String();
      should(adj).not.be.empty();
    });
  });

  describe("generateRandomName", () => {
    it("should return a random formatted name without prefix by default", () => {
      const name = NameGenerator.generateRandomName();

      should(name).be.a.String();
      should(name).not.be.empty();

      should(name).match(/^[a-zA-Z]+-[a-zA-Z]+-[0-9]+$/);
    });

    it("should return a random formatted name with a specified prefix", () => {
      const prefix = "prefix";
      const name = NameGenerator.generateRandomName({ prefix });

      should(name).be.a.String();
      should(name).not.be.empty();

      should(name).match(new RegExp(`^${prefix}-[a-zA-Z]+-[a-zA-Z]+-[0-9]+$`));
    });

    it("should return a random formatted name with a specified random number range", () => {
      const postfixRandRange = { min: 100, max: 1001 };
      const name = NameGenerator.generateRandomName({ postfixRandRange });
      const [minDigits, maxDigits] = [
        postfixRandRange.min.toString().length,
        postfixRandRange.max.toString().length,
      ];

      should(name).be.a.String();
      should(name).not.be.empty();

      should(name).match(
        new RegExp(`^[a-zA-Z]+-[a-zA-Z]+-[0-9]{${minDigits},${maxDigits}}$`)
      );
    });

    it("should return a random formatted name with a specified separator", () => {
      const separator = "_-_";
      const name = NameGenerator.generateRandomName({ separator });

      should(name).be.a.String();
      should(name).not.be.empty();

      should(name).match(
        new RegExp(`^[a-zA-Z]+${separator}[a-zA-Z]+${separator}[0-9]+$`)
      );
    });
  });
});
