module.exports = function CleanAndPrepare (kuzzle, request) {
  return kuzzle.remoteActionsController.actions.cleanDb(kuzzle, request)
    .then(() => {
      return kuzzle.remoteActionsController.actions.prepareDb(kuzzle, request);
    });
};