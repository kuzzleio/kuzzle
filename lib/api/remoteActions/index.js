/*eslint no-console: 0*/
var 
  config = require('../../config'),
  InternalBroker = require('../../services/internalbroker'),
  PluginsManager = require('../core/plugins/pluginsManager'),
  ResquestObject = require('kuzzle-common-objects').Models.requestObject;

module.exports = function RemoteActions (kuzzle) {
  this.kuzzle = kuzzle;
  this.actions = {};

  this.do = function (action, params, args) {
    var
      request,
      onListenCB,
      timeOutCB,
      prepareData,
      pid,
      data,
      isPidMandatory = false;

    if (this.actions[action] === undefined) {
      try {
        this.actions[action] = require('./' + action);
      }
      catch (e) {
        console.log('The action "' + action + '" doesn\'t exist');
        return process.exit(1);
      }
    }

    onListenCB = this.actions[action].onListenCB;
    timeOutCB = this.actions[action].timeOutCB;
    prepareData = this.actions[action].prepareData;
    isPidMandatory = (this.actions[action].isPidMandatory === undefined) || this.actions[action].isPidMandatory;
    pid = params.pid;

    if (!pid) {
      if (!isPidMandatory) {
        pid = 'all';
      } else {
        console.log('The PID parameter is mandatory.');
        return process.exit(1);
      }
    }

    if (pid !== 'all') {
      try {
        process.kill(pid, 0);
      }
      catch (e) {
        console.log('The processus', pid, 'doesn\'t exist');
        return process.exit(1);
      }
    }

    this.kuzzle.config = config(params);
    // the only service we need is the internal broker
    this.kuzzle.services.list = {
      broker: new InternalBroker(kuzzle, {})
    };
    this.kuzzle.pluginsManager = new PluginsManager(this.kuzzle);
    this.kuzzle.pluginsManager.init(this.kuzzle.isServer, true)
      .then(() => {
        this.kuzzle.pluginsManager.run();

        data = prepareData(params, args);

        request = new ResquestObject({controller: 'actions', action: action, body: data});

        this.kuzzle.services.list.broker.listen(request.requestId, onListenCB);

        if (pid === 'all') {
          this.kuzzle.services.list.broker.broadcast(this.kuzzle.config.queues.remoteActionsQueue, request);
        }
        else {
          this.kuzzle.services.list.broker.add(this.kuzzle.config.queues.remoteActionsQueue + '-' + pid, request);
        }

        setTimeout(timeOutCB, 5000);
      })
      .catch(error => {
        console.log('Failed to init Kuzzle plugin manager: ' + error.toString());
      });
  };
};
