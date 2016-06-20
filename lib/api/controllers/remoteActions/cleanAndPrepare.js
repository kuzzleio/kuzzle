/**
 * This is not really constructor
 
 * @param {Kuzzle} kuzzle
 * @param {Request} request
 * @returns {Promise}
 */
module.exports = function CleanAndPrepare (kuzzle, request) {
  return kuzzle.remoteActionsController.actions.cleanDb(kuzzle)
    .then(() => kuzzle.remoteActionsController.actions.prepareDb(kuzzle, request));
};
