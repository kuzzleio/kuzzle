/*eslint no-console: 0*/

var
  uuid = require('node-uuid'),
  config = require('../../config'),
  PluginsManager = require('../core/pluginsManager'),
  clc = require('cli-color'),
  error = clc.red,
  ok = clc.green.bold,
  onListenCB,
  timeOutCB;

module.exports = function cleanAndPrepare (kuzzle, params) {
  var
    fixtures = params.fixtures,
    mappings = params.mappings,
    pid,
    data;

  this.kuzzle = kuzzle;

  if (params._) {
    pid = params._[1];
  }

  if (!pid) {
    pid = 'all';
  }
  else if (pid !== 'all') {
    try {
      process.kill(pid, 0);
    }
    catch (e) {
      console.log('The processus', pid, 'doesn\'t exist');
      return false;
    }
  }

  this.kuzzle.config = config(params);
  this.kuzzle.services.init({blacklist: ['remoteActions', 'mqBroker', 'logger', 'notificationCache', 'monitoring', 'cleanAndPrepare']});
  this.kuzzle.pluginsManager = new PluginsManager(this);
  this.kuzzle.pluginsManager.init(this.isServer, true);
  this.kuzzle.pluginsManager.run();

  data = {
    id: uuid.v1()
  };

  if (fixtures) {
    data.fixtures = fixtures;
  }

  if (mappings) {
    data.mappings = mappings;
  }

  this.kuzzle.services.list.broker.listen(data.id, onListenCB);

  if (pid === 'all') {
    this.kuzzle.services.list.broker.broadcast(this.config.queues.cleanAndPrepareQueue, data);
  }
  else {
    this.kuzzle.services.list.broker.add(this.config.queues.cleanAndPrepareQueue + '-' + pid, data);
  }

  setTimeout(timeOutCB, 5000);

};

onListenCB = (response) => {
  if (response.result.error) {
    console.log(
      error('[✖] An error occured... the process can have started then aborted in the middle.\n    Here is the error:\n'), 
      response.result.error.message
    );
    process.exit(1);
  }
  else {
    console.log(ok('[✔] Kuzzle is now like a virgin, touched for the very first time!'));
    process.exit(0);
  }
};

timeOutCB = () => {
  console.log('Can\'t contact Kuzzle');
  process.exit(1);
};