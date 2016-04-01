var
  cleanDb = require('./cleanDb'),
  prepareDb = require('./prepareDb');

module.exports = function CleanAndPrepare (kuzzle, request) {
  return cleanDb(kuzzle, request)
    .then(() => {
      return prepareDb(kuzzle, request);
    });
};