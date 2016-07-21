var 
  q = require('q');

function Action (params) {
  this.deferred = q.defer();
  this.timeoutTimer = null;  
  this.isPidMandatory = true;
  
  if (params) {
    ['prepareData', 'onListenCB', 'onError', 'onSuccess', 'timeoutCB'].forEach(fn => {
      if (params[fn] && typeof params[fn] === 'function') {
        this[fn] = params[fn];
      }
    });
    
    if (params.isPidMandatory !== undefined) {
      this.isPidMandatory = params.isPidMandatory;
    }
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
  console.log('could not contact Kuzzle in time. Aborting.'); // eslint-disable-line no-console
  process.exit(1);
};

module.exports = Action;
