'use strict';

var
  units = require('node-units'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError;

/**
 * Converts a distance string value to a number of meters
 * @param {string} distance - client-provided distance
 * @returns {Number} resolves to converted distance
 */
function convertDistance (distance) {
  let cleaned, converted;

  // clean up to ensure node-units will be able to convert it
  // for instance: "3 258,55 Ft" => "3258.55 ft"
  cleaned = distance
    .replace(/[-\s]/g, '')
    .replace(/,/g, '.')
    .toLowerCase()
    .replace(/([0-9])([a-z])/, '$1 $2');

  try {
    converted = units.convert(cleaned + ' to m');
  }
  catch (e) {
    throw new BadRequestError(`unable to parse distance value "${distance}"`);
  }

  return converted;
}

/**
 * @type {convertDistance}
 */
module.exports = convertDistance;
