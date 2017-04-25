/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const
  units = require('node-units'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError;

/**
 * Converts a distance string value to a number of meters
 * @param {string} distance - client-provided distance
 * @returns {number} resolves to converted distance
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
