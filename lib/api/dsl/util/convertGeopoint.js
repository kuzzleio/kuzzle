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

const
  geohash = require('ngeohash'),
  Coordinate = require('./coordinate'),
  geoLocationToCamelCase = require('./geoLocationToCamelCase'),
  fieldsExist = require('./fieldsExist');

const regexLatLon = /^([-+]?\d*\.?\d+),\s*([-+]?\d*\.?\d+)$/;
const regexGeohash = /^[0-9a-z]{4,}$/;

/**
 * Converts one of the accepted geopoint format into
 * a standardized version
 *
 * @param {object} obj - object containing a geopoint
 * @returns {Coordinate} or null if no accepted format is found
 */
function convertGeopoint (obj) {
  let point = null;
  const camelCased = geoLocationToCamelCase(obj);

  // Format: { lat: -74.1, lon: 40.73 }
  if (fieldsExist(camelCased, ['lat', 'lon'], 'number')) {
    point = new Coordinate(camelCased.lat, camelCased.lon);
  }
  else if (camelCased.latLon) {
    // Format: { latLon: [ -74.1, 40.73 ] }
    if (Array.isArray(camelCased.latLon) && camelCased.latLon.length === 2) {
      point = new Coordinate(camelCased.latLon[0], camelCased.latLon[1]);
    }
    // Format: { latLon: { lat: 40.73, lon: -74.1 } }
    else if (typeof camelCased.latLon === 'object' && fieldsExist(camelCased.latLon, ['lat', 'lon'], 'number')) {
      point = new Coordinate(camelCased.latLon.lat, camelCased.latLon.lon);
    }
    else if (typeof camelCased.latLon === 'string') {
      let tmp = camelCased.latLon.match(regexLatLon);

      // Format: { latLon: "40.73, -74.1" }
      if (tmp !== null) {
        point = new Coordinate(Number.parseFloat(tmp[1]), Number.parseFloat(tmp[2]));
      }
      // Format: { latLon: "dr5r9ydj2y73"}
      else if (regexGeohash.test(camelCased.latLon)) {
        tmp = geohash.decode(camelCased.latLon);
        point = new Coordinate(tmp.latitude, tmp.longitude);
      }
    }
  }

  return point;
}

/**
 * @type {convertGeopoint}
 */
module.exports = convertGeopoint;
