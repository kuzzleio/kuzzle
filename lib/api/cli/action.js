/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const Request = require('kuzzle-common-objects').Request;

/**
 * @class Action
 */
class Action {
  constructor(params) {
    let resolve, reject;
    const promise = new Promise(function actionGetPromise(...args) {
      resolve = args[0];
      reject = args[1];
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

  prepareData(data) {
    return data;
  }

  onError(error) {
    this.deferred.reject(error);
  }

  onSuccess(response) {
    this.deferred.resolve(response);
  }

  onListenCB(result) {
    clearTimeout(this.timeoutTimer);

    const request = new Request(result.data, result.options);

    if (request.error) {
      return this.onError(request.error);
    }

    return this.onSuccess(request);
  }

  initTimeout() {
    this.timeoutTimer = setTimeout(this.timeOutCB.bind(this), this.timeout);
  }

  timeOutCB() {
    console.log('Unable to connect to Kuzzle'); // eslint-disable-line no-console
    process.exit(1);
  }
}

module.exports = Action;
