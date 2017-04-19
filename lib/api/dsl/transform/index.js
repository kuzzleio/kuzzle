'use strict';

const
  Promise = require('bluebird'),
  Standardizer = require('./standardize'),
  Canonical = require('./canonical'),
  InternalError = require('kuzzle-common-objects').errors.InternalError;

/**
 * Checks that provided filters are valid,
 * standardizes them by reducing the number of used keywords
 * and converts these filters in canonical form
 *
 * @constructor
 */
function Transformer() {
  this.standardizer = new Standardizer();
  this.canonical = new Canonical();

  return this;
}

/**
 * Checks, standardizes and converts filters in canonical form
 *
 * @param {object} filters
 * @return {Promise}
 */
Transformer.prototype.normalize = function normalize(filters) {
  return this.standardizer.standardize(filters)
    .then(standardized => {
      try {
        return this.canonical.convert(standardized);
      }
      catch(e) {
        return Promise.reject(new InternalError(e));
      }
    });
};

/**
 * Performs a simple filter check to validate it, without converting
 * it to canonical form
 *
 * @param {object} filters
 * @return {Promise}
 */
Transformer.prototype.check = function check(filters) {
  return this.standardizer.standardize(filters).then(() => true);
};

/**
 * @type {Transformer}
 */
module.exports = Transformer;
