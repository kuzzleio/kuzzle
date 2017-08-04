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

'use strict';

/**
 * Converts known geolocation fields from snake_case to camelCase
 * Other fields are copied without change
 *
 * @param {object} obj - object containing geolocation fields
 * @returns {object} new object with converted fields
 */
function geoLocationToCamelCase (obj) {
  const 
    converted = {},
    keys = Object.keys(obj);
  let i; // NOSONAR

  for(i = 0; i < keys.length; i++) {
    const
      k = keys[i],
      idx = ['lat_lon', 'top_left', 'bottom_right'].indexOf(k);

    if (idx === -1) {
      converted[k] = obj[k];
    }
    else {
      converted[k
        .split('_')
        .map((v,j) => j === 0 ? v : v.charAt(0).toUpperCase() + v.substring(1))
        .join('')] = obj[k];
    }
  }

  return converted;
}

module.exports = geoLocationToCamelCase;
