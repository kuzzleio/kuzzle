function Action (params) {
  var
    resolve,
    reject,
    promise = new Promise(function () {
      resolve = arguments[0];
      reject = arguments[1];
    });

  this.deferred = {
    resolve,
    reject,
    promise
  };
  this.timeoutTimer = null;  

  if (params) {
    ['prepareData', 'onListenCB', 'onError', 'onSuccess', 'timeOutCB'].forEach(fn => {
      if (params[fn] && typeof params[fn] === 'function') {
        this[fn] = params[fn];
      }
    });
  }
}

Action.prototype.prepareData = function (data) {
  return data;
};

Action.prototype.onError = function (error) {
  this.deferred.reject(error);
};

Action.prototype.onSuccess = function (response) {
  this.deferred.resolve(response);
};

Action.prototype.onListenCB = function (response) {
  clearTimeout(this.timeoutTimer);
  
  if (response.error) {
    return this.onError(response.error);
  }

  return this.onSuccess(response);
};

Action.prototype.initTimeout = function () {
  this.timeoutTimer = setTimeout(this.timeOutCB, 5000);
};

Action.prototype.timeOutCB = function () {
  console.log('Unable to connect to Kuzzle.'); // eslint-disable-line no-console
  process.exit(1);
};

module.exports = Action;
