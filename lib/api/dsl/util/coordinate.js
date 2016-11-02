/**
 * A simple coordinate (lat, lon) class
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
