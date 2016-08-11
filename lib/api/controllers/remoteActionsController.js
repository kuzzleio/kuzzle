var
  ResponseObject = require('kuzzle-common-objects').Models.responseObject,
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  NotFoundError = require('kuzzle-common-objects').Errors.notFoundError;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function RemoteActionsController (kuzzle) {
  this.kuzzle = kuzzle;
  this.actions = {
    adminExists: adminExists.bind(this),
    createFirstAdmin: require('./remoteActions/createFirstAdmin')(kuzzle),
    cleanAndPrepare: require('./remoteActions/cleanAndPrepare')(kuzzle),
    cleanDb: require('./remoteActions/cleanDb')(kuzzle),
    enableServices: require('./remoteActions/enableServices')(kuzzle),
    managePlugins: require('./remoteActions/managePlugins')(kuzzle),
    prepareDb:require('./remoteActions/prepareDb')(kuzzle)
  };

  this.init = () => {
    this.kuzzle.services.list.broker.listen(kuzzle.config.queues.remoteActionsQueue, this.onListenCB);
    this.kuzzle.pluginsManager.trigger('log:info', 'Remote Action Controller initialized');
  };

  this.onListenCB = (request) => {
    var err;
    
    if (!request.action) {
      err = new BadRequestError('No action given.');

      this.kuzzle.services.list.broker.send(request.requestId, new ResponseObject(request, err));
      return false;
    }

    if (!this.actions[request.action]) {
      err = new NotFoundError('The action "' + request.action + '" do not exist.');

      this.kuzzle.services.list.broker.send(request.requestId, new ResponseObject(request, err));
      return false;
    }

    return this.actions[request.action](request)
      .then((response) => {
        this.kuzzle.services.list.broker.send(request.requestId, new ResponseObject(request, response));
      })
      .catch((error) => {
        this.kuzzle.services.list.broker.send(request.requestId, new ResponseObject(request, error));
      });
  };
}

/**
 * @this RemoteActionsController
 */
function adminExists () {
  return this.kuzzle.internalEngine.exists('users', 'admin');
}

module.exports = RemoteActionsController;
