/*eslint no-console: 0*/

var
  uuid = require('node-uuid'),
  config = require('../config'),
  PluginsManager = require('./core/plugins/pluginsManager');

module.exports = function enable (params, enabled) {
  var
    service = params._[1],
    pid = params._[2],
    data;

  if (!service) {
    console.error('Error: missing required argument: service name');
    return false;
  }

  if (!pid) {
    console.error('Error: missing required argument `PID|all\'');
    return false;
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
  this.services.init({blacklist: ['writeEngine', 'readEngine', 'remoteActions', 'mqBroker', 'logger', 'notificationCache', 'monitoring']});
  this.pluginsManager = new PluginsManager(this);
  this.pluginsManager.init(this.isServer, true);
  this.pluginsManager.run()
    .then(() => {
      data = {
        id: uuid.v1(),
        service: service,
        enable: (enabled === undefined) || enabled
      };

      this.services.list.broker.listen(data.id, function (response) {
        if (response.error) {
          console.error(response.error);
          process.exit(1);
        }
        else {
          console.log(response.result);
          process.exit(0);
        }
      });

      if (pid === 'all') {
        this.services.list.broker.broadcast(this.config.queues.remoteActionQueue, data);
      }
      else {
        this.services.list.broker.add(this.config.queues.remoteActionQueue + '-' + pid, data);
      }

      setTimeout(function () {
        console.log('Can\'t contact Kuzzle');
        process.exit(1);
      }, 5000);
    });
};
