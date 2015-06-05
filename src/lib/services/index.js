module.exports = function (kuzzle) {

  return {
    broker: require('./broker'),
    writeEngine: require('./writeEngine')(kuzzle),
    readEngine: require('./readEngine')(kuzzle)
  };

};