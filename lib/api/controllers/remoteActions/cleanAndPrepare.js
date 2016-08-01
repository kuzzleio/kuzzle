var 
  _kuzzle;

/**
 * @param {Request} request
 * @returns {Promise}
 */
function cleanAndPrepare (request) {
  return _kuzzle.remoteActionsController.actions.cleanDb()
    .then(() => _kuzzle.remoteActionsController.actions.prepareDb(request));
}

module.exports = function (kuzzle) {
  _kuzzle = kuzzle;
  return cleanAndPrepare;
};
                      
