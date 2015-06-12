var myHooks = function () {

  this.After('@needCleanDb', function (callback) {
    var main = function () {
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
    };

    main.call(this);
  });

  this.Before('@withWebsocket', function (callback) {
    // change the API
    this.api = this.apiTypes.websocket;

    callback();
  });
};

module.exports = myHooks;