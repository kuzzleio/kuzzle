/*eslint no-console: 0*/

var
  uuid = require('node-uuid'),
  config = require('../config'),
  PluginsManager = require('./core/pluginsManager'),
  clc = require('cli-color'),
  notice = clc.cyanBright,
  error = clc.red,
  ok = clc.green.bold;

module.exports = function enable (params, enabled) {
  var
    fixtures = params.fixtures,
    mappings = params.mappings,
    pid = params._[1],
    data;

  if (!pid) {
    pid = 'all';
  }
  else if (pid !== 'all') {
    try {
      process.kill(pid, 0);
    }
    catch (error) {
      console.error('The processus', pid, 'doesn\'t exist');
      return false;
    }
  }

  this.config = config(params);
  this.services.init({blacklist: ['remoteActions', 'mqBroker', 'logger', 'notificationCache', 'monitoring', 'cleanAndPrepare']});
  this.pluginsManager = new PluginsManager(this);
  this.pluginsManager.init(this.isServer, true);
  this.pluginsManager.run();

  data = {
    id: uuid.v1()
  };

  if (fixtures) {
    data.fixtures = fixtures;
  }

  if (mappings) {
    data.mappings = mappings;
  }

  this.services.list.broker.listen(data.id, (response) => {
    if (response.error) {
      console.error(error('[✖] An error occured... here is the server response:'));
      console.log(response.result.error);
      process.exit(1);
    }
    else {
      console.log(ok('[✔] Kuzzle is now like a virgin, touched for the very first time!'));
      process.exit(0);
    }
  });

  if (pid === 'all') {
    this.services.list.broker.broadcast(this.config.queues.cleanAndPrepareQueue, data);
  }
  else {
    this.services.list.broker.add(this.config.queues.cleanAndPrepareQueue + '-' + pid, data);
  }

  setTimeout(() => {
    console.log('Can\'t contact Kuzzle');
    process.exit(1);
  }, 5000);
};
