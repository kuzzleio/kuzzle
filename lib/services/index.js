module.exports = function (kuzzle) {

  this.list = {};
  this.kuzzle = kuzzle;

  this.init = function () {
    this.list = {
      // The broker object is used for internal message communication, especially between Kuzzle and its workers
      broker: require('./ipc'),

      // The MQ Broker is used to establish communication between Kuzzle and AMQP, MQTT or STOMP clients
      mqBroker: require('./rabbit'),

      // The Write and the Read engines manage access to persistent data storage
      writeEngine: require('./elasticsearch'),
      readEngine: require('./elasticsearch'),

      // The logger service allow advanced logging and metrics
      logger: require('./logger'),

      // The Notification Cache is used to track users subscriptions
      notificationCache: require('./redis'),

      monitoring: require('./newrelic')
    };

    this.list.broker.init(this.kuzzle.config);
    this.list.mqBroker.init(this.kuzzle.config);
    this.list.logger.init();
    this.list.writeEngine.init(this.kuzzle.config, 'writeEngine');
    this.list.readEngine.init(this.kuzzle.config, 'readEngine');
    this.list.notificationCache.init(this.kuzzle.config, 'notificationCache');
    this.list.monitoring.init(this.kuzzle);
  };

};