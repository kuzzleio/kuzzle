module.exports = function (kuzzle) {

  this.list = {};
  this.kuzzle = kuzzle;

  this.init = function (options) {
    var
      blacklist = [],
      server = false;

    if (options) {
      if (options.blacklist) {
        blacklist = options.blacklist;
      }

      server = options.server || false;
    }

    this.list = {
      // The broker object is used for internal message communication, especially between Kuzzle and its workers
      broker: require('./internalbroker'),

      // The MQ Broker is used to establish communication between Kuzzle and AMQP, MQTT or STOMP clients
      mqBroker: require('./rabbit'),

      // The Write and the Read engines manage access to persistent data storage
      writeEngine: require('./elasticsearch'),
      readEngine: require('./elasticsearch'),

      // The logger service allow advanced logging and metrics
      logger: require('./logger'),

      // The Notification Cache is used to track users subscriptions
      notificationCache: require('./redis'),

      monitoring: require('./newrelic'),
      profiling: require('./nodegrind'),

      remoteActions: require('./remoteActions')
    };

    if (blacklist.indexOf('broker') === -1) {
      this.list.broker.init(this.kuzzle.config, server);
    }
    if (blacklist.indexOf('mqBroker') === -1) {
      this.list.mqBroker.init(this.kuzzle.config);
    }
    if (blacklist.indexOf('logger') === -1) {
      this.list.logger.init();
    }
    if (blacklist.indexOf('writeEngine') === -1) {
      this.list.writeEngine.init(this.kuzzle.config, 'writeEngine');
    }
    if (blacklist.indexOf('readEngine') === -1) {
      this.list.readEngine.init(this.kuzzle.config, 'readEngine');
    }
    if (blacklist.indexOf('notificationCache') === -1) {
      this.list.notificationCache.init(this.kuzzle.config, 'notificationCache');
    }
    if (blacklist.indexOf('monitoring') === -1 && process.env.NEW_RELIC_APP_NAME) {
      this.list.monitoring.init(this.kuzzle);
    }
    if (blacklist.indexOf('remoteActions') === -1) {
      this.list.remoteActions.init(this.kuzzle);
    }
    if (blacklist.indexOf('profiling') === -1) {
      this.list.profiling.init(this.kuzzle);
    }
  };

};