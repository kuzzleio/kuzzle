var
  ResponseObject = require('kuzzle-common-objects').Models.responseObject,
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  NotFoundError = require('kuzzle-common-objects').Errors.notFoundError,
  AdminController = require('./adminController');

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function RemoteActionsController (kuzzle) {
  var adminController = new AdminController(kuzzle);

  this.kuzzle = kuzzle;

  this.actions = {
    adminExists: adminController.adminExists,
    createFirstAdmin: adminController.createFirstAdmin,
    cleanDb: require('./remoteActions/cleanDb')(kuzzle),
    clearCache: require('./remoteActions/clearCache')(kuzzle),
    managePlugins: require('./remoteActions/managePlugins')(kuzzle),
    data: require('./remoteActions/data')(kuzzle)
  };

  this.init = () => {
    this.kuzzle.services.list.broker.listen(this.kuzzle.config.queues.remoteActionsQueue, this.onListenCB);
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

module.exports = RemoteActionsController;
