/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

'use strict';

const nativeControllers = require('../../../api/controllers');

class ImpersonatedSDK {
  constructor (sdk, userId) {
    this.sdk = sdk;
    this.userId = userId;

    for (const controller of Object.keys(nativeControllers)) {
      const controllerName = controller.toLowerCase();
      const subProxyName = `${controllerName}ProxyMethod`;

      if (! Object.prototype.hasOwnProperty.call(
        this.sdk,
        controllerName)) {
        continue;
      }

      Reflect.defineProperty(this, controllerName, {
        get: () => {
          if (! Object.prototype.hasOwnProperty.call(this, subProxyName)) {
            this[subProxyName] = new Proxy(this.sdk[controllerName], {
              get: (target, property) => {
                return target[property].bind({
                  query: (request, options) => {
                    request.controller = controllerName;

                    return this.query(request, options);
                  }
                });
              }
            });
          }

          return this[subProxyName];
        }
      });
    }
  }

  query (request, options = {}) {
    request.__userId__ = this.userId;

    return this.sdk.query(request, options);
  }
}

module.exports = ImpersonatedSDK;