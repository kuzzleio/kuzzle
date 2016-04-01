var
  ResponseObject = require('../core/models/responseObject'),

  cleanDb = require('./remoteActions/cleanDb'),
  prepareDb = require('./remoteActions/prepareDb'),
  cleanAndPrepare = require('./remoteActions/cleanAndPrepare'),
  enableServices = require('./remoteActions/enableServices');

module.exports = function RemoteActionsController (kuzzle) {
  this.kuzzle = kuzzle;
  this.uniqueTaskQueue = null;
  this.actions = {
    'cleanDb': cleanDb,
    'prepareDb': prepareDb,
    'cleanAndPrepare': cleanAndPrepare,
    'enableServices': enableServices
  };

  this.init = () => {
    this.uniqueTaskQueue = this.kuzzle.config.queues.remoteActionsQueue + '-' + process.pid;

    this.kuzzle.services.list.broker.listen(this.kuzzle.config.queues.remoteActionsQueue, this.onListenCB);
    this.kuzzle.services.list.broker.listen(this.uniqueTaskQueue, this.onListenCB);
    this.kuzzle.pluginsManager.trigger('log:info', 'Remote Action Controller initialized');
  };

  this.onListenCB = (request) => {
    if (!request.action) {
      this.kuzzle.services.list.broker.add(request.requestId, {error: 'No action given.'});
      return false;
    }

    if (!this.actions[request.action]) {
      this.kuzzle.services.list.broker.add(request.requestId, {error: 'The action ' + request.action + ' do not exist.'});
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