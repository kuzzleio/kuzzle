/*eslint no-console: 0*/
var 
  availableRemoteActions = require('../../config/remoteActions'),
  remoteActions = {},
  uuid = require('node-uuid'),
  config = require('../../config'),
  PluginsManager = require('../core/pluginsManager'),
  ResquestObject = require('../core/models/requestObject');

availableRemoteActions.forEach(function (action) {
  remoteActions[action] = require('./' + action);
});

module.exports = function (kuzzle, action, params, args) {
  var
    request,
    onListenCB,
    timeOutCB,
    prepareData,
    name,
    pid,
    data,
    isPidMandatory = false;

  if (!remoteActions[action]) {
    return false;
  }

  name = remoteActions[action].name;
  onListenCB = remoteActions[action].onListenCB;
  timeOutCB = remoteActions[action].timeOutCB;
  prepareData = remoteActions[action].prepareData;
  isPidMandatory = (remoteActions[action].isPidMandatory === undefined) || remoteActions[action].isPidMandatory;

  if (params._) {
    pid = params._[1];
  }

  if (!pid) {
    if (!isPidMandatory) {
      pid = 'all';
    } else {
      console.log('The PID parameter is mandatory.');
      process.exit(1);
    }
  }

  if (pid !== 'all') {
    try {
      process.kill(pid, 0);
    }
    catch (e) {
      console.log('The processus', pid, 'doesn\'t exist');
      process.exit(1);
    }
  }

  kuzzle.config = config(params);
  kuzzle.services.init({blacklist: ['mqBroker', 'logger', 'notificationCache', 'monitoring']});
  kuzzle.pluginsManager = new PluginsManager(kuzzle);
  kuzzle.pluginsManager.init(kuzzle.isServer, true);
  kuzzle.pluginsManager.run();

  data = prepareData(params, args);

  request = new ResquestObject({controller: 'remoteActions', action: action, body: data});

  kuzzle.services.list.broker.listen(request.requestId, onListenCB);

  if (pid === 'all') {
    kuzzle.services.list.broker.broadcast(kuzzle.config.queues.remoteActionsQueue, request);
  }
  else {
    kuzzle.services.list.broker.add(kuzzle.config.queues.remoteActionsQueue + '-' + pid, request);
  }

  setTimeout(timeOutCB, 5000);

};