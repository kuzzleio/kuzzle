var myHooks = function () {

  this.After('@needCleanDb', function (callback) {
    var main = function () {
      var options = {
        url: this.pathApi(this.fakeCollection),
        method: 'DELETE'
      };

      this.callApi(options)
        .then(function () {
          callback();
        })
        .catch(function (error) {
          callback(new Error(error));
        });
    };

    main.call(this);
  });
};

module.exports = myHooks;