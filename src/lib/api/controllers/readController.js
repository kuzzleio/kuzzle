module.exports = function WriteController (kuzzle) {

  this.search = function (data) {
    return kuzzle.services.list.readEngine.read(data);
  };

};