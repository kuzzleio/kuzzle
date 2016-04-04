var
  ResponseObject = require('../core/models/responseObject'),
  BadRequestError = require('../core/errors/badRequestError'),
  NotFoundError = require('../core/errors/notFoundError'),
  q = require('q'),
  actions = {
    cleanDb: require('./remoteActions/cleanDb'),
    prepareDb:require('./remoteActions/prepareDb'),
    cleanAndPrepare: require('./remoteActions/cleanAndPrepare'),
    enableServices: require('./remoteActions/enableServices')
  };

module.exports = function RemoteActionsController (kuzzle) {
  this.kuzzle = kuzzle;
  this.uniqueTaskQueue = null;
  this.actions = actions;

  this.init = () => {
    this.uniqueTaskQueue = this.kuzzle.config.queues.remoteActionsQueue + '-' + process.pid;

    this.kuzzle.services.list.broker.listen(this.kuzzle.config.queues.remoteActionsQueue, this.onListenCB);
    this.kuzzle.services.list.broker.listen(this.uniqueTaskQueue, this.onListenCB);
    this.kuzzle.pluginsManager.trigger('log:info', 'Remote Action Controller initialized');
  };

  this.onListenCB = (request) => {
    var resp, err;
    if (!request.action) {
      err = new BadRequestError('No action given.');
      resp = new ResponseObject(request, err);

      this.kuzzle.services.list.broker.add(request.requestId, resp);
      return false;
    }

    if (!this.actions[request.action]) {
      err = new NotFoundError('The action "' + request.action + '" do not exist.');
      resp = new ResponseObject(request, err);

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