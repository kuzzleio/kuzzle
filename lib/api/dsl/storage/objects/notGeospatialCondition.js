/**
 * @param {string} id
 * @param {Object} subfilter
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
