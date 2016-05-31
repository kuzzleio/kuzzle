var
  ResponseObject = require('../core/models/responseObject'),
  BadRequestError = require('../core/errors/badRequestError'),
  NotFoundError = require('../core/errors/notFoundError');

module.exports = function RemoteActionsController (kuzzle) {
  this.kuzzle = kuzzle;
  this.uniqueTaskQueue = null;
  this.actions = {
    cleanDb: require('./remoteActions/cleanDb'),
    prepareDb:require('./remoteActions/prepareDb'),
    cleanAndPrepare: require('./remoteActions/cleanAndPrepare'),
    enableServices: require('./remoteActions/enableServices'),
    swagger: require('./remoteActions/swagger')
  };

  this.init = () => {
    this.uniqueTaskQueue = this.kuzzle.config.queues.remoteActionsQueue + '-' + process.pid;

    this.kuzzle.services.list.broker.listen(this.kuzzle.config.queues.remoteActionsQueue, this.onListenCB);
    this.kuzzle.services.list.broker.listen(this.uniqueTaskQueue, this.onListenCB);
    this.kuzzle.pluginsManager.trigger('log:info', 'Remote Action Controller initialized');
  };

  this.onListenCB = (request) => {
    var err;
    
    if (!request.action) {
      err = new BadRequestError('No action given.');

      this.kuzzle.services.list.broker.add(request.requestId, new ResponseObject(request, err));
      return false;
    }

    if (!this.actions[request.action]) {
      err = new NotFoundError('The action "' + request.action + '" do not exist.');

      this.kuzzle.services.list.broker.add(request.requestId, new ResponseObject(request, err));
      return false;
    }

    return this.actions[request.action](this.kuzzle, request)
      .then((response) => {
        this.kuzzle.services.list.broker.add(request.requestId, new ResponseObject(request, response));
      })
      .catch((error) => {
        this.kuzzle.services.list.broker.add(request.requestId, new ResponseObject(request, error));
      });
  };
};