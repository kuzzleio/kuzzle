var
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  Promise = require('bluebird'),
  _kuzzle;

/**
 * @param {RequestObject} request
 * @returns {Promise}
 */
function data (request) {
  var promises = [];

  if (request.data.body.fixtures) {
    Object.keys(request.data.body.fixtures).forEach((index => {
      Object.keys(request.data.body.fixtures[index]).forEach((collection) => {
        promises.push(_kuzzle.services.list.storageEngine.import(new RequestObject({
          index: index,
          collection: collection,
          body: {
            bulkData: request.data.body.fixtures[index][collection]
          }
        }))
          .then(response => {
            if (response.partialErrors
              && response.partialErrors.length > 0
            ) {
              throw new Error(JSON.stringify(response.data.body));
            }

            return response.items;
          })
        );
      });
    }));
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
 * @returns {data}
 */
module.exports = function remoteData (kuzzle) {
  _kuzzle = kuzzle;
  return data;
};
