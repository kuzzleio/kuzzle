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
  constructor (kuid, options) {
    this.kuid = kuid;
    this.checkRights = options.checkRights || false;

    for (const controller of Object.keys(nativeControllers)) {
      // @todo in the future, native controller names should be normalized to sdk naming
      const controllerName = controller
        .replace('Controller', '')
        .replace('MemoryStorage', 'ms')
        .toLowerCase();
      const subProxyName = `${controllerName}ProxyMethod`;

      if (! global.app.sdk[controllerName]) {
        continue;
      }

      Reflect.defineProperty(this, controllerName, {
        get: () => {
          if (! this[subProxyName]) {
            this[subProxyName] = new Proxy(global.app.sdk[controllerName], {
              get: (target, property) => {
                return target[property].bind({
                  query: (request, opts) => {
                    request.controller = controllerName;

                    return this.query(request, opts);
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
    request.__kuid__ = this.kuid;
    request.__checkRights__ = this.checkRights;

    return global.app.sdk.query(request, options);
  }
}

module.exports = ImpersonatedSDK;
