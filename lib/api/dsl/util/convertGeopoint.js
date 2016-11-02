var
  geohash = require('ngeohash'),
  Coordinate = require('./coordinate'),
  geoLocationToCamelCase = require('./geoLocationToCamelCase'),
  fieldsExist = require('./fieldsExist'),
  regexLatLon = /^[-.0-9]+,\s*[-.0-9]+$/,
  regexGeohash = /^[0-9a-z]{4,}$/;

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
    camelCased = geoLocationToCamelCase(obj),
    tmp;

  // { lat: -74.1, lon: 40.73 }
  if (fieldsExist(camelCased, ['lat', 'lon'], 'number')) {
    point = new Coordinate(camelCased[0], camelCased[1]);
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
      // { latLon: "40.73, -74.1" }
      if (regexLatLon.test(camelCased.latLon)) {
        tmp = camelCased.latLon.match(regexLatLon);
        point = new Coordinate(tmp[2], tmp[1]);
      }
      // { latLon: "dr5r9ydj2y73"}
      if (point === null && regexGeohash.test(camelCased.latLon)) {
        tmp = geohash.decode(camelCased.latLon);
        point = new Coordinate(tmp.latitude, tmp.longitude);
      }
    }
  }

  return point;
}

module.exports = convertGeopoint;
