/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

const { BadRequestError } = require('../kerror/errors');

/**
 * Throws if the provided data is not an object.
 * Returns the unmodified data if validated
 *
 * @throws
 * @param {string} attr - tested attribute name
 * @param {*} data
 * @return {object}
 */
function assertObject (attr, data) {
  if (data === null || data === undefined) {
    return null;
  }

  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new BadRequestError(`Attribute ${attr} must be of type "object"`);
  }

  return data;
}

/**
 * Throws if the provided data is not an array containing exclusively
 * values of the specified "type"
 * Returns a clone of the provided array if valid
 *
 * @throws
 * @param {string} attr - tested attribute name
 * @param {*} data
 * @return {array}
 */
function assertArray (attr, data, type) {
  if (data === null || data === undefined) {
    return [];
  }

  if (! Array.isArray(data)) {
    throw new BadRequestError(`Attribute ${attr} must be of type "array"`);
  }

  const clone = [];

  for (const d of data) {
    if (d !== undefined && d !== null) {
      if (typeof d !== type) {
        throw new BadRequestError(`Attribute ${attr} must contain only values of type "${type}"`);
      }

      clone.push(d);
    }
  }

  return clone;
}

/**
 * Throws if the provided data is not a string
 * Returns the unmodified data if validated
 *
 * @throws
 * @param {string} attr - tested attribute name
 * @param {*} data
 * @return {null|string}
 */
function assertString (attr, data) {
  if (data === null || data === undefined) {
    return null;
  }

  if (typeof data !== 'string') {
    throw new BadRequestError(`Attribute ${attr} must be of type "string"`);
  }

  return data;
}

/**
 * Throws if the provided data is not an integer
 * Returns the unmodified data if validated
 *
 * @throws
 * @param {string} attr - tested attribute name
 * @param {*} data
 * @return {number}
 */
function assertInteger (attr, data) {
  if (! Number.isInteger(data)) {
    throw new BadRequestError(`Attribute ${attr} must be an integer`);
  }

  return data;
}

module.exports = {
  assertArray,
  assertInteger,
  assertObject,
  assertString,
};
