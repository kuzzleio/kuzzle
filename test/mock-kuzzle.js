'use strict';

const mockRequire = require('mock-require');

function mockKuzzle () {
  const KuzzleMock = require('./mocks/kuzzle.mock');
  mockRequire('../lib/kuzzle/kuzzle', KuzzleMock);
}

// BAD but, oh well, it makes things so much easier...
const savedStopAll = mockRequire.stopAll.bind(mockRequire);

mockRequire.stopAll = () => {
  savedStopAll();
  mockKuzzle();
};

module.exports = mockKuzzle;

mockKuzzle();

