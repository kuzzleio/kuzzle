function Action (params) {
  var
    resolve,
    reject,
    promise = new Promise(function actionGetPromise () {
      resolve = arguments[0];
      reject = arguments[1];
    });

  this.deferred = {
    resolve,
    reject,
    promise
  };
  this.timeout = 15000;
  this.timeoutTimer = null;  

  if (params) {
    ['prepareData', 'onListenCB', 'onError', 'onSuccess', 'timeOutCB'].forEach(fn => {
      if (params[fn] && typeof params[fn] === 'function') {
        this[fn] = params[fn];
      }
    });
    if (params.timeout) {
      this.timeout = params.timeout;
    }
  }
}

Action.prototype.prepareData = function actionPrepareData (data) {
  return data;
};

Action.prototype.onError = function actionOnError (error) {
  this.deferred.reject(error);
};

Action.prototype.onSuccess = function actionOnSuccess (response) {
  this.deferred.resolve(response);
};

Action.prototype.onListenCB = function actionOnListenCB (response) {
  clearTimeout(this.timeoutTimer);
  
  if (response.error) {
    return this.onError(response.error);
  }

  return this.onSuccess(response);
};

Action.prototype.initTimeout = function actionInitTimeout () {
  this.timeoutTimer = setTimeout(this.timeOutCB.bind(this), this.timeout);
};

Action.prototype.timeOutCB = function actionTimeoutCB () {
  console.log('Unable to connect to Kuzzle'); // eslint-disable-line no-console
  process.exit(1);
};

module.exports = Action;
