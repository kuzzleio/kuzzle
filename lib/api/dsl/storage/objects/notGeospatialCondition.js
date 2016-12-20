'use strict';

/**
 * Stores a "not geoDistance", "not geoBoundingBox",
 * "not geoDistanceRange" or "not geoPolygon" condition
 *
 * This allows V8 to convert this object to a pure
 * C++ class, with direct access to its members,
 * instead of a dictionary with b-search access time
 *
 * @param {string} id
 * @param {object} subfilter
 * @constructor
 */
function NotGeospatialCondition (id, subfilter) {
  this.id = id;
  this.subfilters = [subfilter];
}

/**
 * @type {NotGeospatialCondition}
 */
module.exports = NotGeospatialCondition;
