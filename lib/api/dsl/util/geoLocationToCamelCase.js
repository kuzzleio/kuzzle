/**
 * Converts known geolocation fields from snake_case to camelCase
 * Other fields are copied without change
 *
 * @param {Object} obj - object containing geolocation fields
 * @returns {Object} new object with converted fields
 */
function geoLocationToCamelCase (obj) {
  var
    converted = {};

  Object.keys(obj).forEach(k => {
    var
      idx = ['lat_lon', 'top_left', 'bottom_right'].indexOf(k);

    if (idx === -1) {
      converted[k] = obj[k];
    }
    else {
      converted[k
        .split('_')
        .map((v, i) => i === 0 ? v : v.charAt(0).toUpperCase() + v.substring(1))
        .join('')] = obj[k];
    }
  });

  return converted;
}

module.exports = geoLocationToCamelCase;
