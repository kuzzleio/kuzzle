var
  _ = require('lodash'),
  BadRequestError = require('../core/errors/badRequestError'),
  geohash = require('ngeohash'),
  units = require('node-units'),
  geoUtil;

module.exports = geoUtil = {
  /**
   * Construct a valid usable BBox
   *
   * @param {Object} geoFilter the given object
   * @return {Object} the valid usable BBox object
   */
  constructBBox: function (geoFilter) {
    var top, left, bottom, right, tmp;
    // { top: -74.1, left: 40.73, bottom: -71.12, right: 40.01 }
    if (geoFilter.top &&
      geoFilter.left &&
      geoFilter.bottom &&
      geoFilter.right
    ) {
      top = geoFilter.top;
      left = geoFilter.left;
      bottom = geoFilter.bottom;
      right = geoFilter.right;
    }
    // { topLeft: { lat: 40.73, lon: -74.1 }, bottomRight: { lat: 40.01, lon: -71.12 } }
    else if (geoFilter.topLeft &&
      geoFilter.bottomRight &&
      geoFilter.topLeft.lat &&
      geoFilter.topLeft.lon &&
      geoFilter.bottomRight.lat &&
      geoFilter.bottomRight.lon
    ) {
      top = geoFilter.topLeft.lon;
      left = geoFilter.topLeft.lat;
      bottom = geoFilter.bottomRight.lon;
      right = geoFilter.bottomRight.lat;
    }
    // { topLeft: [ -74.1, 40.73 ], bottomRight: [ -71.12, 40.01 ] }
    else if (geoFilter.topLeft &&
      geoFilter.bottomRight &&
      _.isArray(geoFilter.topLeft) &&
      _.isArray(geoFilter.bottomRight)
    ) {
      top = geoFilter.topLeft[0];
      left = geoFilter.topLeft[1];
      bottom = geoFilter.bottomRight[0];
      right = geoFilter.bottomRight[1];
    }
    // { topLeft: "40.73, -74.1", bottomRight: "40.01, -71.12" }
    else if (geoFilter.topLeft &&
      geoFilter.bottomRight &&
      _.isString(geoFilter.topLeft) &&
      _.isString(geoFilter.bottomRight) &&
      /^[-.0-9]+,\s*[-.0-9]+$/.test(geoFilter.topLeft) &&
      /^[-.0-9]+,\s*[-.0-9]+$/.test(geoFilter.bottomRight)
    ) {
      tmp = geoFilter.topLeft.match(/^([-.0-9]+),\s*([-.0-9]+)$/);
      top = tmp[2];
      left = tmp[1];

      tmp = geoFilter.bottomRight.match(/^([-.0-9]+),\s*([-.0-9]+)$/);
      bottom = tmp[2];
      right = tmp[1];
    }
    // { topLeft: "dr5r9ydj2y73", bottomRight: "drj7teegpus6" }
    else if (geoFilter.topLeft &&
      geoFilter.bottomRight &&
      _.isString(geoFilter.topLeft) &&
      _.isString(geoFilter.bottomRight) &&
      /^[0-9a-z]{4,}$/.test(geoFilter.topLeft) &&
      /^[0-9a-z]{4,}$/.test(geoFilter.bottomRight)
    ) {
      tmp = geohash.decode(geoFilter.topLeft);
      top = tmp.longitude;
      left = tmp.latitude;

      tmp = geohash.decode(geoFilter.bottomRight);
      bottom = tmp.longitude;
      right = tmp.latitude;
    }

    if (top && left && bottom && right) {
      if (!_.isNumber(top)) {
        top = parseFloat(top);
      }
      if (!_.isNumber(left)) {
        left = parseFloat(left);
      }
      if (!_.isNumber(bottom)) {
        bottom = parseFloat(bottom);
      }
      if (!_.isNumber(right)) {
        right = parseFloat(right);
      }
    }
    else {
      throw new BadRequestError('Unable to parse coordinates');
    }

    return {top: top, left: left, bottom: bottom, right: right};
  },

  /**
   * Construct a valid usable BBox
   *
   * @param {Object} geoFilter the given object
   * @return {Object} the valid usable BBox object
   */
  constructPolygon: function (geoFilter) {
    var point,
      polygon = [];

    if (geoFilter.points === undefined) {
      throw new BadRequestError('No point list found');
    }

    if (!_.isArray(geoFilter.points)) {
      throw new BadRequestError('A polygon must be in array format');
    }

    if (geoFilter.points.length < 3) {
      throw new BadRequestError('A polygon must have at least 3 points');
    }

    geoFilter.points.forEach(function (entry) {
      point = geoUtil.constructPoint(entry);
      polygon.push(point);
    });

    return polygon;
  },

  /**
   * Construct a valid usable point
   *
   * @param {Object} geoFilter the given object
   * @return {Object} the valid usable point object
   */
  constructPoint: function (geoFilter) {
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
  getDistance: function (distance) {
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