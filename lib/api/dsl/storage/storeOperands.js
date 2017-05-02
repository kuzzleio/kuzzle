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

import IntervalTree from 'node-interval-tree';

const
  SortedArray = require('sorted-array'),
  strcmp = require('../util/stringCompare'),
  NotEqualsCondition = require('./objects/notEqualsCondition'),
  NotGeospatialCondition = require('./objects/notGeospatialCondition'),
  RegexpCondition = require('./objects/regexpCondition'),
  BoostSpatialIndex = require('boost-geospatial-index');

/**
 * Exposes a sets of methods meant to store operands in
 * the DSL keyword-specific part of a field-operand  object
 *
 * All provided <f,o> pair object references must point directly
 * to the right index/collection/keyword part of the structure
 *
 * @class OperandsStorage
 * */
class OperandsStorage {
  /**
   * Stores an empty filter in the <f,o> pairs structure
   * There can never be more than 1 filter and subfilter for an
   * all-matching filter, for an index/collection pair
   *
   * @param {object} foPairs
   * @param {object} subfilter
   */
  everything(foPairs, subfilter) {
    foPairs.fields.all = [subfilter];
  }

  /**
   * Stores a "equals" condition into the field-operand structure
   *
   * @param {object} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  equals(foPairs, subfilter, condition) {
    const
      fieldName = Object.keys(condition.value)[0],
      value = condition.value[fieldName];

    if (!foPairs.fields[fieldName]) {
      foPairs.keys.insert(fieldName);
      foPairs.fields[fieldName] = new Map();
      foPairs.fields[fieldName].set(value, [subfilter]);
    }
    else if (foPairs.fields[fieldName].has(value)) {
      foPairs.fields[fieldName].get(value).push(subfilter);
    }
    else {
      foPairs.fields[fieldName].set(value, [subfilter]);
    }
  }

  /**
   * Stores a "not equals" condition into the field-operand structure
   *
   * @param {object} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  notequals(foPairs, subfilter, condition) {
    const
      fieldName = Object.keys(condition.value)[0],
      value = new NotEqualsCondition(condition.value[fieldName], subfilter);
    let idx;

    if (!foPairs.fields[fieldName]) {
      foPairs.keys.insert(fieldName);
      foPairs.fields[fieldName] = {
        values: new SortedArray([value], (a, b) => {
          if (a.value === b.value) {
            return 0;
          }
          return a.value < b.value ? -1 : 1;
        })
      };
    }
    else if ((idx = foPairs.fields[fieldName].values.search(value)) >= 0) {
      foPairs.fields[fieldName].values.array[idx].subfilters.push(subfilter);
    }
    else {
      foPairs.fields[fieldName].values.insert(value);
    }
  }

  /**
   * Stores a "exists" condition into the field-operand structure
   *
   * @param {object} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  exists(foPairs, subfilter, condition) {
    const fieldName = condition.value.field;

    if (!foPairs.fields[fieldName]) {
      foPairs.keys.insert(fieldName);
      foPairs.fields[fieldName] = [subfilter];
    }
    else {
      foPairs.fields[fieldName].push(subfilter);
    }
  }

  /**
   * Stores a "not exists" condition into the field-operand structure
   *
   * @param {object} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  notexists(foPairs, subfilter, condition) {
    this.exists(foPairs, subfilter, condition);
  }

  /**
   * Stores a "range" condition into the field-operand structure
   *
   * Stores the range in interval trees for searches in O(log n + m)
   *
   * @param {object} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  range(foPairs, subfilter, condition) {
    const
      field = Object.keys(condition.value)[0],
      args = condition.value[field];
    let
      low = -Infinity,
      high = Infinity;

    /*
     Initializes low and high values depending on condition arguments
     As the interval tree library used only considers inclusive boundaries,
     we need to add or substract an epsilon value to provided arguments
     for lt and gt options.
     */
    Object.keys(args).forEach(a => {
      if (['gt', 'gte'].indexOf(a) !== -1) {
        low = a === 'gt' ? args[a] + 1e-10 : args[a];
      }

      if (['lt', 'lte'].indexOf(a) !== -1) {
        high = a === 'lt' ? args[a] - 1e-10 : args[a];
      }
    });

    if (!foPairs.fields[field]) {
      foPairs.keys.insert(field);
      foPairs.fields[field] = {
        tree: new IntervalTree(),
        count: 1,
        subfilters: {
          [subfilter.id]: {
            [condition.id]: {subfilter, low, high}
          }
        }
      };
    }
    else {
      if (!foPairs.fields[field].subfilters[subfilter.id]) {
        foPairs.fields[field].subfilters[subfilter.id] = {};
      }
      foPairs.fields[field].subfilters[subfilter.id][condition.id] = {subfilter, low, high};
      foPairs.fields[field].count++;
    }

    foPairs.fields[field].tree.insert(low, high, subfilter);
  }

  /**
   * Stores a "not range" condition into the field-operand structure
   *
   * "not range" conditions are stored as an inverted range,
   * meaning that if a user subscribes to the following range:
   *      [min, max]
   * Then we register the following ranges in the tree:
   *      ]-Infinity, min[
   *      ]max, +Infinity[
   *
   * (boundaries are also reversed: inclusive boundaries become
   * exclusive, and vice-versa)
   *
   * Matching is then executed exactly like for "range" conditions.
   * This does not hurt performances as searches in the interval tree
   * are in O(log n)
   *
   * (kudos to @asendra for this neat trick)
   *
   * @param {object} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  notrange(foPairs, subfilter, condition) {
    const
      field = Object.keys(condition.value)[0],
      args = condition.value[field];
    let
      low = -Infinity,
      high = Infinity;

    /*
     Initializes low and high values depending on condition arguments
     As the interval tree library used only considers inclusive boundaries,
     we need to add or substract an epsilon value to provided arguments
     for lte and gte options
     This is the reverse operation than the one done for the "range"
     keyword, as we then invert the searched range.
     */
    Object.keys(args).forEach(a => {
      if (['gt', 'gte'].indexOf(a) !== -1) {
        low = a === 'gte' ? args[a] - 1e-10 : args[a];
      }

      if (['lt', 'lte'].indexOf(a) !== -1) {
        high = a === 'lte' ? args[a] + 1e-10 : args[a];
      }
    });

    if (!foPairs.fields[field]) {
      foPairs.keys.insert(field);
      foPairs.fields[field] = {
        tree: new IntervalTree(),
        count: 1,
        subfilters: {
          [subfilter.id]: {
            [condition.id]: {subfilter, low, high}
          }
        }
      };
    }
    else {
      if (!foPairs.fields[field].subfilters[subfilter.id]) {
        foPairs.fields[field].subfilters[subfilter.id] = {};
      }
      foPairs.fields[field].subfilters[subfilter.id][condition.id] = {subfilter, low, high};
      foPairs.fields[field].count++;
    }

    if (low !== -Infinity) {
      foPairs.fields[field].tree.insert(-Infinity, low, subfilter);
    }

    if (high !== Infinity) {
      foPairs.fields[field].tree.insert(high, Infinity, subfilter);
    }
  }

  /**
   * Stores a "regexp" condition into the field-operand structure
   *
   * @param {object} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  regexp(foPairs, subfilter, condition) {
    const
      fieldName = Object.keys(condition.value)[0],
      value = new RegexpCondition(condition.value[fieldName].value, subfilter, condition.value[fieldName].flags);
    let idx;

    if (!foPairs.fields[fieldName]) {
      foPairs.keys.insert(fieldName);
      foPairs.fields[fieldName] = {
        expressions: new SortedArray([value], (a, b) => strcmp(a.stringValue, b.stringValue))
      };
    }
    else if ((idx = foPairs.fields[fieldName].expressions.search(value)) >= 0) {
      foPairs.fields[fieldName].expressions.array[idx].subfilters.push(subfilter);
    }
    else {
      foPairs.fields[fieldName].expressions.insert(value);
    }
  }

  /**
   * Stores a "not regexp" condition into the field-operand structure
   *
   * @param {object} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  notregexp(foPairs, subfilter, condition) {
    this.regexp(foPairs, subfilter, condition);
  }

  /**
   * Stores a "geospatial" condition into the field-operand structure
   *
   * @param {object} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  geospatial(foPairs, subfilter, condition) {
    const
      geotype = Object.keys(condition.value)[0],
      fieldName = Object.keys(condition.value[geotype])[0],
      value = condition.value[geotype][fieldName];

    if (!foPairs.custom.index) {
      foPairs.custom.index = new BoostSpatialIndex();
    }

    if (!foPairs.fields[fieldName]) {
      foPairs.keys.insert(fieldName);
      foPairs.fields[fieldName] = {
        [condition.id]: [subfilter]
      };
    }
    else if (foPairs.fields[fieldName][condition.id]) {
      foPairs.fields[fieldName][condition.id].push(subfilter);

      // skip the shape insertion in the geospatial index
      return;
    }
    else {
      foPairs.fields[fieldName][condition.id] = [subfilter];
    }

    storeGeoshape(foPairs.custom.index, geotype, condition.id, value);
  }

  /**
   * Stores a "not geospatial" condition into the field-operand structure
   *
   * @param {object} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  notgeospatial(foPairs, subfilter, condition) {
    const
      geotype = Object.keys(condition.value)[0],
      fieldName = Object.keys(condition.value[geotype])[0],
      value = condition.value[geotype][fieldName],
      cond = new NotGeospatialCondition(condition.id, subfilter);
    let idx;

    if (!foPairs.custom.index) {
      foPairs.custom.index = new BoostSpatialIndex();
    }

    if (!foPairs.fields[fieldName]) {
      foPairs.keys.insert(fieldName);
      foPairs.fields[fieldName] = {
        ids: new SortedArray([cond], (a, b) => strcmp(a.id, b.id))
      };
    }
    else if ((idx = foPairs.fields[fieldName].ids.search(cond)) !== -1) {
      foPairs.fields[fieldName].ids.array[idx].subfilters.push(subfilter);

      // skip the shape insertion in the geospatial index
      return;
    }
    else {
      foPairs.fields[fieldName].ids.insert(cond);
    }

    storeGeoshape(foPairs.custom.index, geotype, condition.id, value);
  }
}

/**
 * Stores a geospatial shape in the provided index object.
 *
 * @param {object} index
 * @param {string} type
 * @param {string} id
 * @param {Object|Array} shape
 */
function storeGeoshape(index, type, id, shape) {
  switch (type) {
    case 'geoBoundingBox':
      index.addBoundingBox(id,
        shape.bottom,
        shape.left,
        shape.top,
        shape.right
      );
      break;
    case 'geoDistance':
      index.addCircle(id, shape.lat, shape.lon, shape.distance);
      break;
    case 'geoDistanceRange':
      index.addAnnulus(id, shape.lat, shape.lon, shape.to, shape.from);
      break;
    case 'geoPolygon':
      index.addPolygon(id, shape);
      break;
    default:
      break;
  }
}

module.exports = OperandsStorage;
