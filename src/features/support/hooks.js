var myHooks = function () {

  this.After('@needCleanDb', function (callback) {
    var filters = {
      query: {
        'match_all': {}
      }
    };

    this.api.deleteByQuery(filters)
      .then(function () {
        callback();
      })
      .catch(function (error) {
        callback(new Error(error));
      });
  });

  this.After('@removeSchema', function (callback) {
    this.api.deleteCollection()
      .then(function () {
        setTimeout(callback, 1000);
      })
      .catch(function (error) {
        callback(new Error(error));
      });
  });

  this.Before('@withWebsocket', function (callback) {
    // change the API
    this.api = this.apiTypes.websocket;

    callback();
  });
};

module.exports = myHooks;