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

    this.list.broker.init(kuzzle);
    this.list.logger.init(kuzzle);
    this.list.writeEngine.init(kuzzle, 'writeEngine');
    this.list.readEngine.init(kuzzle, 'readEngine');
    this.list.notificationCache.init(kuzzle, 'notificationCache');
  };

};