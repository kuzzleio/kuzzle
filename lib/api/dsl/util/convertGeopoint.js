'use strict';

var
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
 * @param {Object} obj - object containing a geopoint
 * @returns {Coordinate} or null if no accepted format is found
 */
function convertGeopoint (obj) {
  var
    point = null,
    camelCased = geoLocationToCamelCase(obj);

  // { lat: -74.1, lon: 40.73 }
  if (fieldsExist(camelCased, ['lat', 'lon'], 'number')) {
    point = new Coordinate(camelCased.lat, camelCased.lon);
  }
  else if (camelCased.latLon) {
    // { latLon: [ -74.1, 40.73 ] }
    if (Array.isArray(camelCased.latLon) && camelCased.latLon.length === 2) {
      point = new Coordinate(camelCased.latLon[0], camelCased.latLon[1]);
    }
    // { latLon: { lat: 40.73, lon: -74.1 } }
    else if (typeof camelCased.latLon === 'object' && fieldsExist(camelCased.latLon, ['lat', 'lon'], 'number')) {
      point = new Coordinate(camelCased.latLon.lat, camelCased.latLon.lon);
    }
    else if (typeof camelCased.latLon === 'string') {
      let tmp = camelCased.latLon.match(regexLatLon);

      // { latLon: "40.73, -74.1" }
      if (tmp !== null) {
        point = new Coordinate(Number.parseFloat(tmp[1]), Number.parseFloat(tmp[2]));
      }
      // { latLon: "dr5r9ydj2y73"}
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
