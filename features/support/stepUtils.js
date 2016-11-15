exports.getReturn = function () {
  var
    args = Array.prototype.slice.call(arguments),
    action = args.shift(),
    cb = args.pop();

  this.api[action].apply(this.api, args)
    .then(response => {
      if (response.error) {
        return cb(new Error(response.error));
      }

      this.result = response;
      cb();
    })
    .catch(error => {
      cb(error);
    });
};
