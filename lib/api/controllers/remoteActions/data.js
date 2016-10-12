var
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  Promise = require('bluebird'),
  _kuzzle;

/**
 * @param {Request} request
 * @returns {Promise}
 */
function data (request) {
  var promises = [];

  if (request.data.body.fixtures) {
    promises.push(_kuzzle.services.list.storageEngine.import(new RequestObject({
      index: request.index,
      collection: request.collection,
      body: {
        bulkData: request.data.body.fixtures
      }
    }))
      .then(response => {
        if (response.error) {
          throw response.error;
        }

        if (response.status === 206
          && response.data.body.errors.filter(e => e.status !== 409).length > 0) {
          throw response.data.body;
        }

        return response.data.body;
      })
    );
  }

  if (request.data.body.mappings) {
    Object.keys(request.data.body.mappings).forEach(index => {
      Object.keys(request.data.body.mappings[index]).forEach(collection => {
        promises.push(_kuzzle.services.list.storageEngine.updateMapping(new RequestObject({
          index,
          collection,
          body: request.data.body.mappings[index][collection]
        })));
      });
    });
  }

  return Promise.all(promises)
    .catch(error => {
      var kuzzleError = new InternalError(error.message);
      kuzzleError.stack = error.stack;
      _kuzzle.pluginsManager.trigger('log:error', '!! An error occurred during the process.\nHere is the original error message:\n' + error.message);

      throw kuzzleError;
    });
}

/**
 *
 * @param {Kuzzle} kuzzle
 * @returns {prepareDb}
 */
module.exports = function (kuzzle) {
  _kuzzle = kuzzle;
  return data;
};
