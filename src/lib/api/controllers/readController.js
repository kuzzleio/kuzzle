module.exports = function WriteController (kuzzle) {

  this.search = function (data) {
    return kuzzle.services.list.readEngine.search(data);
  };

  this.get = function (data) {
    return kuzzle.services.list.readEngine.get(data);
  };

};