/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

const BaseType = require('../baseType');
const { Koncorde } = require('../../shared/KoncordeWrapper');

/**
 * @class GeoPointType
 */
class GeoPointType extends BaseType {
  constructor() {
    super();
    this.typeName = 'geo_point';
    this.allowChildren = false;
    this.allowedTypeOptions = [];
  }

  /**
   * @param {TypeOptions} typeOptions
   * @param {*} fieldValue
   * @param {string[]} errorMessages
   * @returns {boolean}
   */
  validate(typeOptions, fieldValue, errorMessages) {
    if (Koncorde.convertGeopoint(fieldValue) === null) {
      errorMessages.push('Invalid GeoPoint format');
      return false;
    }

    return true;
  }
}

module.exports = GeoPointType;
