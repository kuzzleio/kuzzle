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
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  config = require('../../../config'),
  Combinatorics = require('js-combinatorics'),
  Espresso = require('espresso-logic-minimizer').Espresso,
  strcmp = require('../util/stringCompare');

/**
 * Converts filters in canonical form
 *
 * @constructor
 */
class Canonical {
  /**
   * Entry point of the normalizer: takes a filter in, and reduces it
   * into a simplified version
   *
   * Result format:
   *  [
   *    [{condition: {...}, not: <boolean>}, {condition: {...}, not: <boolean>}, ...],
   *    [{condition: {...}, not: <boolean>}, {condition: {...}, not: <boolean>}, ...],
   *    ...
   *  ]
   *
   * Explanation:
   *  Each array entry contains an array of conditions. Each one of these conditions are linked
   *  using a AND operand.
   *  Array entries are linked together with OR operands.
   *
   * @param filters
   * @return {Array} resolving to a simplified filters array
   * @throws if espresso is unable to normalize the provided filters
   */
  convert (filters) {
    let result = [];

    if (Object.keys(filters).length === 0) {
      return [[{'everything': true}]];
    }

    const conditions = this._extractConditions(filters);
    if (conditions.length > config.limits.subscriptionConditionsCount) {
      throw new BadRequestError('Maximum number of sub conditions reached.');
    }

    const normalized = this._normalize(filters, conditions);

    normalized.forEach(entry => {
      const
        ors = [],
        subresult = [];

      // Declaring "i" inside the "for" statement downgrades
      // performances by a factor of 3 to 4
      // Should be fixed in later V8 versions
      // (tested on Node 6.9.x)
      let i; // NOSONAR

      for (i = 0; entry.charAt(i) !== ' ' && i < entry.length; i++) {
        // espresso output character can have the following values: '0', '1' or '-'
        const
          n = parseInt(entry.charAt(i), 2),
          sub = conditions[i];

        if (!isNaN(n)) {
          // eslint-disable-next-line no-extra-boolean-cast
          sub.not = !(Boolean(n));

          if (sub.or || sub.and) {
            const conds = sub.not
              ? this._notAndOr(sub.or || sub.and)
              : this._andOr(sub.or || sub.and);

            if (sub.and && !sub.not || sub.or && sub.not) {
              // and case
              subresult.push(...conds);
            }
            else {
              ors.push(conds);
            }
          }
          else {
            subresult.push(sub);
          }
        }
      }

      if (ors.length === 0 && subresult.length > 0) {
        result.push(subresult);
      }
      else if (ors.length > 0) {
        const combinations = Combinatorics.cartesianProduct(...ors);
        let n = combinations.length;

        while (n) {
          n--;
          result.push(subresult.concat(combinations.next()));
        }
      }

    });

    result = this._removeImpossiblePredicates(result);

    for (const sub of result) {
      sub.sort((a, b) => {
        const
          k1 = Object.keys(a).find(k => k !== 'not'),
          k2 = Object.keys(b).find(k => k !== 'not');

        return strcmp(k1, k2);
      });
    }

    return result;
  }

  /**
   * Transforms an array of conditions into the format expected by the store
   * @param {Object[]} conds
   * @private
   */
  _andOr (conds) {
    return conds.map(c => {
      if (c.not) {
        return Object.assign(c.not, {
          not: true
        });
      }
      return Object.assign(c, {not: false});
    });
  }

  /**
   * Custom _.cloneDeep equivalent, which keeps the _isLeaf non-enumerable property of the filters
   * @param {Array|Object} filters
   * @returns {Array|Object}
   * @private
   */
  _cloneFilters (filters) { //NOSONAR
    if (Array.isArray(filters)) {
      return filters.map(v => this._cloneFilters(v));
    }

    if (!(filters instanceof Object)) {
      return filters;
    }

    const clone = {};

    for (const k of Object.keys(filters)) {
      if (Array.isArray(filters[k])) {
        clone[k] = filters[k].map(v => this._cloneFilters(v));
      }
      else if (filters[k] instanceof Object) {
        clone[k] = this._cloneFilters(filters[k]);
      }
      else {
        clone[k] = filters[k];
      }
    }

    if (filters._isLeaf !== undefined) {
      clone._isLeaf = filters._isLeaf;
    }

    return clone;
  }

  /**
   * Extracts the conditions from a filter set
   *
   * @param {object} filters
   * @param {Array} [conditions]
   * @return {Array}
   */
  _extractConditions (filters, conditions = []) {
    const key = Object.keys(filters)[0];

    if (['and', 'or', 'not'].indexOf(key) === -1) {
      conditions.push(this._cloneFilters(filters));
      return conditions;
    }

    if (key === 'not') {
      return this._extractConditions(filters[key], conditions);
    }

    if (filters._isLeaf) {
      conditions.push(this._cloneFilters(filters));
      return conditions;
    }

    return filters[key].reduce((p, c) => this._extractConditions(c, p), conditions);
  }

  /**
   * Given some standardized filters, returns the DNF form in espresso format
   * @param filters
   * @param conditions
   * @returns {String[]}
   * @private
   */
  _normalize (filters, conditions) {
    if (conditions.length === 1) {
      const
        zero = evalFilter(filters, [0]),
        one = evalFilter(filters, [1]),
        combined = `${zero >>> 0}${one >>> 0}`; // string binary representation of the truth table output

      if (combined === '00') {
        return [];
      }
      else if (combined === '01') {
        return ['1 1'];
      }
      else if (combined === '10') {
        return ['0 1'];
      }
      else if (combined === '11') {
        return ['- 1'];
      }
    }

    const
      baseN = Combinatorics.baseN([0, 1], conditions.length),
      espresso = new Espresso(conditions.length, 1);

    let row;
    while ((row = baseN.next())) {
      espresso.push(row, [evalFilter(filters, row)]);
    }

    return espresso.minimize();
  }

  /**
   * Negates an array of filters in the format expected by the storage
   * @param conds
   * @private
   */
  _notAndOr (conds) {
    return conds.map(c => {
      if (c.not) {
        return Object.assign(c.not, {not: false});
      }

      return Object.assign(c, {
        not: true
      });
    });
  }

  _removeImpossiblePredicates (ors) {
    const result = [];

    for (const ands of ors) {
      const operators = {
        equals: {},
        exists: {},
        notequals: {},
        notexists: {},
        range: {}
      };
      let skip = false;

      for (const sub of ands) {   // we *do* want to break as soon as possible NOSONAR
        let
          field,
          operator,
          value;

        for (const prop in sub) {
          if (sub.hasOwnProperty(prop) && prop !== 'not') {
            operator = prop;
            if (operator === 'exists') {
              field = sub[prop].field;
            }
            else {
              field = Object.keys(sub[prop])[0];
            }
            value = sub[prop][field];
          }
        }

        if (operator === 'equals' && sub.not === false) {
          if (operators.equals[field] !== undefined && operators.equals[field] !== value) {
            skip = true;
            break;
          }
          operators.equals[field] = value;

          if (operators.notexists[field]
            || operators.notequals[field] && operators.notequals[field][value]
            || operators.range[field]
            && (operators.range[field].lt !== undefined && value >= operators.range[field].lt
              || operators.range[field].lte !== undefined && value > operators.range[field].lte
              || operators.range[field].gt !== undefined && value <= operators.range[field].gt
              || operators.range[field].gte !== undefined && value < operators.range[field].gte
            )
          ) {
            skip = true;
            break;
          }
        }
        else if (operator === 'equals' && sub.not === true) {
          if (!operators.notequals[field]) {
            operators.notequals[field] = {};
          }
          operators.notequals[field][value] = true;

          if (operators.equals[field] === value) {
            skip = true;
            break;
          }
        }
        else if (operator === 'exists' && sub.not === false) {
          operators.exists[field] = true;

          if (operators.notexists[field]) {
            skip = true;
            break;
          }
        }
        else if (operator === 'exists' && sub.not === true) {
          operators.notexists[field] = true;

          if (operators.equals[field] !== undefined
            || operators.exists[field]
            || operators.range[field]) {
            skip = true;
            break;
          }
        }
        else if (operator === 'range' && sub.not === false) {
          // naive test only. We keep only the last range and don't test not condition
          operators.range[field] = value;

          if (operators.notexists[field]
            || operators.equals[field] !== undefined
            && (value.lt !== undefined && operators.equals[field] >= value.lt
              || value.lte !== undefined && operators.equals[field] > value.lte
              || value.gt !== undefined && operators.equals[field] <= value.gt
              || value.gte !== undefined && operators.equals[field] < value.gte
            )
          ) {
            skip = true;
            break;
          }
        }
      }

      if (!skip) {
        result.push(ands);
      }
    }

    if (result.length === 0) {
      return [[{nothing: true}]];
    }

    return result;
  }
}


/**
 * Given a boolean array containing the conditions results, returns
 * a boolean indicating the whole filter result
 *
 * @param {object} filters
 * @param {Array} results - condition results, contains booleans
 * @param {object} [pos] - current condition position
 * @returns {boolean}
 */
function evalFilter(filters, results, pos = {value: 0}) {
  const key = Object.keys(filters)[0];

  if (['and', 'or', 'not'].indexOf(key) === -1 || filters._isLeaf) {
    pos.value++;
    return results[pos.value - 1];
  }

  if (key === 'not') {
    return !evalFilter(filters[key], results, pos);
  }

  return filters[key].reduce((p, c) => {
    const r = evalFilter(c, results, pos);

    if (p === null) {
      return r;
    }

    return key === 'and' ? p && r : p || r;
  }, null);
}

module.exports = Canonical;
