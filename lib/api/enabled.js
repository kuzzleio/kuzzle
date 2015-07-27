var Services = require('../services');

module.exports = function enabled (params) {

  this.services = new Services(this);
  this.services.init(['writeEngine', 'readEngine', 'logger', 'notificationCache', 'remoteActions', 'newrelic']);

  var
    service = params._[1],
    taskQueue = this.services.list.remoteActions.taskQueue,
    data;

  if (!this.services.list[service]) {
    console.log('The service', service, 'is undefined');
    process.exit(1);
  }

  data = {
    enabled: true,
    service: service
  };

  this.services.list.broker.add(taskQueue, data, true);
  setTimeout(function() {
    process.exit(0);
  }, 1000);

};