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
  constructor (kuid, options = {}) {
    this.kuid = kuid;
    this.checkRights = options.checkRights || false;

    for (const controller of Object.keys(nativeControllers)) {
      // @todo in the future, native controller names should be normalized to sdk naming
      const controllerName = controller
        .replace('Controller', '')
        .replace('MemoryStorage', 'ms')
        .toLowerCase();
      const controllerProxy = `${controllerName}Proxy`;

      if (! global.app.sdk[controllerName]) {
        continue;
      }

      // Lazily wrap in runtime; native 'sdk' controllers and induce custom 'query' beaviour
      Reflect.defineProperty(this, controllerName, {
        get: () => {
          // If the requested controller has not yet been proxied
          if (! this[controllerProxy]) {

            // Create a proxy object to inject our local 'query' behaviour
            // in the underlying base 'sdk' action methods so we can send
            // impersonation configuration (kuid & checkRights) to the funnel
            this[controllerProxy] = new Proxy(global.app.sdk[controllerName], {
              get: (controllerInstance, actionName) => {
                const customContext = {
                  kuzzle: global.app.sdk,
                  query: (request, opts) => {
                    request.controller = controllerName;

                    // Call the 'ImpersonatedSdk.query' method instead
                    return this.query(request, opts);
                  }
                };

                // Make sure we bring any local methods into our new custom context
                Object.getOwnPropertyNames(Object.getPrototypeOf(global.app.sdk[controllerName]))
                  .forEach((localMethod) => {
                    if (!['constructor', 'query'].includes(localMethod)) {
                      customContext[localMethod] = controllerInstance[localMethod];
                    }
                  });

                // Return the original SDK action method AND also bind our merged custom context
                // containing our 'query' method and any original local methods
                return controllerInstance[actionName].bind(customContext);
              }
            });
          }

          return this[controllerProxy];
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
