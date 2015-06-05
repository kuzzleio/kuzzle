module.exports = function (kuzzle) {

  this.list = {};
  this.kuzzle = kuzzle;

  this.init = function () {
    this.list = {
      broker: require('./broker'),
      writeEngine: require('./writeEngine'),
      readEngine: require('./readEngine')
    };

    this.list.writeEngine.init(kuzzle);
    this.list.readEngine.init(kuzzle);
  };

};