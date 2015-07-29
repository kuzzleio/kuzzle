module.exports = function (kuzzleConfig) {

  this.list = {};
  this.kuzzleConfig = kuzzleConfig;

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

      //
      monitoring: require('./newrelic')
    };

    this.list.broker.init(kuzzleConfig);
    this.list.mqBroker.init(kuzzleConfig);
    this.list.logger.init();
    this.list.writeEngine.init(kuzzleConfig, 'writeEngine');
    this.list.readEngine.init(kuzzleConfig, 'readEngine');
    this.list.notificationCache.init(kuzzleConfig, 'notificationCache');
    this.list.monitoring.init(kuzzleConfig);
  };

};