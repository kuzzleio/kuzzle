var
  uuid = require('node-uuid');

module.exports = function enable (params, boolean) {

  var
    service = params._[1],
    data;

  this.services.init(['writeEngine', 'readEngine', 'remoteActions', 'mqBroker', 'logger', 'notificationCache', 'monitoring', 'profiling']);

  data = {
    id: uuid.v1(),
    enable: boolean || true,
    service: service
  };

  this.services.list.broker.listen(data.id, function (response) {
    if (response.error) {
      console.error(response.error);
      process.exit(1);
    }

    if (data.enable) {
      console.log('The service', service, 'is enabled');
    }
    else {
      console.log('The service', service, 'is disabled');
    }

    process.exit(0);
  });

  this.services.list.broker.add(this.config.queues.remoteActionQueue, data);

  setTimeout(function() {
    console.log('Can\'t contact Kuzzle');
    process.exit(1);
  }, 5000);

};
