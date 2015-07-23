module.exports = function (kuzzle) {

  this.list = {};
  this.kuzzle = kuzzle;

  this.init = function () {
    this.list = {
      broker: require('./broker'),
      writeEngine: require('./elasticsearch'),
      logger: require('./logger'),
      readEngine: require('./elasticsearch'),
      notificationCache: require('./redis')
    };

    this.list.broker.init(kuzzle.config);
    this.list.logger.init();
    this.list.writeEngine.init(kuzzle.config, 'writeEngine');
    this.list.readEngine.init(kuzzle.config, 'readEngine');
    this.list.notificationCache.init(kuzzle.config, 'notificationCache');
  };

};