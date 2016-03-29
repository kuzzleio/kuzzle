/*eslint no-console: 0*/
var 
  remotes = {
    cleanAndPrepare: require('./cleanAndPrepare'),
    enableServices: require('./enableServices')
  },
  uuid = require('node-uuid'),
  config = require('../../config'),
  PluginsManager = require('../core/pluginsManager');

module.exports = function (kuzzle, remote, params, args) {
  var
    onListenCB,
    timeOutCB,
    prepareData,
    name,
    pid,
    data,
    isPidMandatory = false;

  if (!remotes[remote]) {
    return false;
  }

  name = remotes[remote].name;
  onListenCB = remotes[remote].onListenCB;
  timeOutCB = remotes[remote].timeOutCB;
  prepareData = remotes[remote].prepareData;
  isPidMandatory = (remotes[remote].isPidMandatory === undefined) || remotes[remote].isPidMandatory;

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
  kuzzle.services.init({blacklist: ['remoteActions', 'mqBroker', 'logger', 'notificationCache', 'monitoring', 'cleanAndPrepare']});
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