module.exports = function (kuzzle) {

  this.list = {};
  this.kuzzle = kuzzle;

  this.init = function () {
    this.list = {
      broker: require('./broker'),
      writeEngine: require('./elasticsearch'),
      readEngine: require('./elasticsearch'),
      cache: require('./redis')
    };

    this.list.writeEngine.init(kuzzle, 'writeEngine');
    this.list.readEngine.init(kuzzle, 'readEngine');
    this.list.cache.init(kuzzle);
  };

};