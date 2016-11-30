var
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  Request = require('kuzzle-common-objects').Request,
  Promise = require('bluebird'),
  _kuzzle;

/**
 * @param {Request} request
 * @returns {Promise}
 */
function data (request) {
  var promises = [];

  if (request.input.body.fixtures) {
    Object.keys(request.input.body.fixtures).forEach((index => {
      Object.keys(request.input.body.fixtures[index]).forEach((collection) => {
        promises.push(_kuzzle.services.list.storageEngine.import(new Request({
          index: index,
          collection: collection,
          body: {
            bulkData: request.input.body.fixtures[index][collection]
          }
        }))
          .then(response => {
            if (response.partialErrors && response.partialErrors.length > 0) {
              throw new Error(JSON.stringify(response.data.body));
            }

            return response.items;
          })
        );
      });
    }));
  }

  if (request.input.body.mappings) {
    Object.keys(request.input.body.mappings).forEach(index => {
      Object.keys(request.input.body.mappings[index]).forEach(collection => {
        promises.push(_kuzzle.services.list.storageEngine.updateMapping(new Request({
          index,
          collection,
          body: request.input.body.mappings[index][collection]
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
module.exports = function cliData (kuzzle) {
  _kuzzle = kuzzle;
  return data;
};
