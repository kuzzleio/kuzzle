module.exports = function ReadController (kuzzle) {

  this.search = function (requestObject) {
    return kuzzle.services.list.readEngine.search(requestObject);
  };

  this.get = function (requestObject) {
    return kuzzle.services.list.readEngine.get(requestObject);
  };

  this.count = function (requestObject) {
    return kuzzle.services.list.readEngine.count(requestObject);
  };
};