module.exports = function CleanAndPrepare (kuzzle, request) {
  return kuzzle.remoteActionsController.actions.cleanDb(kuzzle, request)
    .then(() => kuzzle.remoteActionsController.actions.prepareDb(kuzzle, request));
};
