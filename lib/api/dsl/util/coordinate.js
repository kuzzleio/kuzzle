'use strict';

/**
 * A simple coordinate (lat, lon) class
 *
 * This allows V8 to convert this object to a pure
 * C++ class, with direct access to its members,
 * instead of a dictionary with b-search access time
 *
 * @constructor
 */
function Coordinate(lat, lon) {
  this.lat = lat;
  this.lon = lon;

  return this;
}

/**
 * @type {Coordinate}
 */
module.exports = Coordinate;
