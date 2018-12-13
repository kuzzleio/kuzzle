/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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

/* eslint-disable no-console */

const deprecationWarning = (...args) => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('DEPRECATION WARNING');
    console.warn(...args);
  }
};

const warnIfDeprecated = (deprecations, member) => {
  const
    deprecatedProperty = Object.keys(deprecations).find(deprecated => deprecated === member),
    alternative = deprecations[deprecatedProperty];

  if (!deprecatedProperty) {
    return;
  }

  if (alternative && typeof alternative.message === 'string') {
    deprecationWarning(alternative.message);
  } else if (typeof alternative === 'string') {
    deprecationWarning(`Use of '${deprecatedProperty}' property is deprecated. Please, use '${alternative}' instead.`);
  } else {
    deprecationWarning(`Use of '${deprecatedProperty}' property is deprecated.`);
  }
};

const deprecateProperties = (target, deprecations = {}) => {
  if (process.env.NODE_ENV === 'production') {
    return target;
  }

  return new Proxy(target, {
    get(object, key, ...rest) {
      if (key === '__isProxy') {
        return true;
      }

      warnIfDeprecated(deprecations, key);

      return Reflect.get(object, key, ...rest);
    },

    set(object, key, ...rest) {
      warnIfDeprecated(deprecations, key);

      return Reflect.set(object, key, ...rest);
    }
  });
};

module.exports = {
  deprecateProperties
};
