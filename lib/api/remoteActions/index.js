/*eslint no-console: 0*/
var 
  availableRemoteActions = require('../../config/remoteActions'),
  remoteActions = {},
  uuid = require('node-uuid'),
  config = require('../../config'),
  PluginsManager = require('../core/pluginsManager');

availableRemoteActions.forEach(function (remoteAction) {
  remoteActions[remoteAction] = require('./' + remoteAction);
});

module.exports = function (kuzzle, remoteAction, params, args) {
  var
    onListenCB,
    timeOutCB,
    prepareData,
    name,
    pid,
    data,
    isPidMandatory = false;

  if (!remoteActions[remoteAction]) {
    return false;
  }

  name = remoteActions[remoteAction].name;
  onListenCB = remoteActions[remoteAction].onListenCB;
  timeOutCB = remoteActions[remoteAction].timeOutCB;
  prepareData = remoteActions[remoteAction].prepareData;
  isPidMandatory = (remoteActions[remoteAction].isPidMandatory === undefined) || remoteActions[remoteAction].isPidMandatory;

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
  kuzzle.services.init({blacklist: ['enableServices', 'mqBroker', 'logger', 'notificationCache', 'monitoring', 'cleanAndPrepare']});
  kuzzle.pluginsManager = new PluginsManager(kuzzle);
  kuzzle.pluginsManager.init(kuzzle.isServer, true);
  kuzzle.pluginsManager.run();

  data = prepareData(params, args);

  data.id = uuid.v1();

  kuzzle.services.list.broker.listen(data.id, onListenCB);

  if (pid === 'all') {
    kuzzle.services.list.broker.broadcast(kuzzle.config.queues[name + 'Queue'], data);
  }
  else {
    kuzzle.services.list.broker.add(kuzzle.config.queues[name + 'Queue'] + '-' + pid, data);
  }

  setTimeout(timeOutCB, 5000);

};