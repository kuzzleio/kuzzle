module.exports = function (kuzzle) {

  this.list = {};
  this.kuzzle = kuzzle;

  this.init = function () {
    this.list = {
      broker: require('./broker'),
      writeEngine: require('./elasticsearch'),
      readEngine: require('./elasticsearch')
    };

    this.list.writeEngine.init(kuzzle);
    this.list.readEngine.init(kuzzle);
  };

};