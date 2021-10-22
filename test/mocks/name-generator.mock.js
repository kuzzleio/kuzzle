'use strict';

function randomNumberMock (max) {
  return max;
}

function generateRandomNameMock (prefix) {
  return `${prefix}-adjective-name-123456`;
}

module.exports = { generateRandomNameMock, randomNumberMock };