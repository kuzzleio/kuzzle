"use strict";

class NameGeneratorMock {
  static getRandomNameMock() {
    return "name";
  }

  static getRandomAdjectiveMock() {
    return "adjective";
  }

  static generateRandomNameMock({
    prefix,
    separator = "-",
    postfixRandRange = { min: 0, max: 100000 },
  }) {
    const adjective = NameGeneratorMock.getRandomAdjectiveMock();
    const name = NameGeneratorMock.getRandomNameMock();

    prefix = prefix !== undefined ? `${prefix}${separator}` : "";

    if (postfixRandRange === false) {
      return `${prefix}${adjective}${separator}${name}`;
    }

    const { min = 0, max } = postfixRandRange;

    return `${prefix}${adjective}${separator}${name}${separator}${randomNumberMock(
      min,
      max
    )}`;
  }
}

function randomNumberMock(min, max) {
  if (max === undefined) {
    max = min;
  }

  return max;
}

module.exports = { NameGeneratorMock, randomNumberMock };
