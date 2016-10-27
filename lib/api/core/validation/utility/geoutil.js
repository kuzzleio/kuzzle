var
  _ = require('lodash'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  geohash = require('ngeohash'),
  units = require('node-units');

module.exports = {
  /**
   * Construct a valid usable point
   *
   * @param {Object} geoFilter the given object
   * @return {Object} the valid usable point object
   */
  constructPoint: function geoutilConstructPoint (geoFilter) {
    var lat, lon, tmp;

    // { lat: -74.1, lon: 40.73 }
    if (geoFilter.lat !== undefined &&
      geoFilter.lon !== undefined
    ) {
      lat = geoFilter.lat;
      lon = geoFilter.lon;
    }
    // { latLon: { lat: 40.73, lon: -74.1 } }
    else if (geoFilter.latLon &&
      geoFilter.latLon.lat !== undefined &&
      geoFilter.latLon.lon !== undefined
    ) {
      lat = geoFilter.latLon.lat;
      lon = geoFilter.latLon.lon;
    }
    // { latLon: [ -74.1, 40.73 ] }
    else if (geoFilter.latLon &&
      _.isArray(geoFilter.latLon)
    ) {
      lat = geoFilter.latLon[0];
      lon = geoFilter.latLon[1];
    }
    // { latLon: "40.73, -74.1" }
    else if (geoFilter.latLon &&
      _.isString(geoFilter.latLon) &&
      /^[-.0-9]+,\s*[-.0-9]+$/.test(geoFilter.latLon)
    ) {
      tmp = geoFilter.latLon.match(/^([-.0-9]+),\s*([-.0-9]+)$/);
      lat = tmp[2];
      lon = tmp[1];
    }
    // { latLon: "dr5r9ydj2y73"}
    else if (geoFilter.latLon &&
      _.isString(geoFilter.latLon) &&
      /^[0-9a-z]{4,}$/.test(geoFilter.latLon)
    ) {
      tmp = geohash.decode(geoFilter.latLon);
      lat = tmp.latitude;
      lon = tmp.longitude;
    } else if (_.isArray(geoFilter)) {
      lat = geoFilter[0];
      lon = geoFilter[1];
    }

    if (lat !== undefined && lon !== undefined) {
      if (!_.isNumber(lat)) {
        lat = parseFloat(lat);
      }
      if (!_.isNumber(lon)) {
        lon = parseFloat(lon);
      }
    }
    else {
      throw new BadRequestError('Unable to parse coordinates');
    }
    return {lat: lat, lon: lon};
  },

  /**
   * Generate a valid usable distance
   *
   * @param {String} distance the given distance
   * @return {Object} the distance in meters
   */
  getDistance: function geoutilGetDistance (distance) {
    var tmp;
    if (_.isString(distance)) {
      // just clean enough the distance so that localized notations (like "3 258,55 Ft" instead of "3258.55 ft")
      // could be accepted
      tmp = distance.replace(/-/, '').replace(/ /, '').replace(/,/, '.').toLowerCase().replace(/([0-9])([a-z])/, '$1 $2');

      try {
        // units.convert validate the string, so that we do not need further cleanup
        distance = units.convert(tmp + ' to m');
      }
      catch (err) {
        throw new BadRequestError('Unable to parse the distance filter parameter');
      }
    }
    else {
      // nothing else, lets assume that the distance is already in meters
    }

    return distance;
  }
};