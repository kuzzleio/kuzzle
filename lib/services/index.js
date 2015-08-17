module.exports = function (kuzzle) {

  this.list = {};
  this.kuzzle = kuzzle;

  this.init = function (blackList) {
    if (!blackList) {
      blackList = [];
    }

    this.list = {
      // The broker object is used for internal message communication, especially between Kuzzle and its workers
      broker: require('./ipc'),

      // The MQ Broker is used to establish communication between Kuzzle and AMQP, MQTT or STOMP clients
      mqBroker: require('./rabbit'),

      // The Write and the Read engines manage access to persistent data storage
      writeEngine: require('./elasticsearch'),
      readEngine: require('./elasticsearch'),

      // The perf logger service allow advanced logging and metrics
      perf: require('./logstash'),

      // The Notification Cache is used to track users subscriptions
      notificationCache: require('./redis'),

      monitoring: require('./newrelic'),
      profiling: require('./nodegrind'),

      remoteActions: require('./remoteActions')
    };

    if (blackList.indexOf('broker') === -1) {
      this.list.broker.init(this.kuzzle.config);
    }
    if (blackList.indexOf('mqBroker') === -1) {
      this.list.mqBroker.init(this.kuzzle.config);
    }
    if (blackList.indexOf('perf') === -1) {
      this.list.perf.init();
    }
    if (blackList.indexOf('writeEngine') === -1) {
      this.list.writeEngine.init(this.kuzzle.config, 'writeEngine');
    }
    if (blackList.indexOf('readEngine') === -1) {
      this.list.readEngine.init(this.kuzzle.config, 'readEngine');
    }
    if (blackList.indexOf('notificationCache') === -1) {
      this.list.notificationCache.init(this.kuzzle.config, 'notificationCache');
    }
    if (blackList.indexOf('monitoring') === -1 && process.env.NEW_RELIC_APP_NAME) {
      this.list.monitoring.init(this.kuzzle);
    }
    if (blackList.indexOf('remoteActions') === -1) {
      this.list.remoteActions.init(this.kuzzle);
    }
    if (blackList.indexOf('profiling') === -1) {
      this.list.profiling.init(this.kuzzle);
    }
  };

};