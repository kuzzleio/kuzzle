var
  Promise = require('bluebird'),
  Standardizer = require('./standardize'),
  Canonical = require('./canonical'),
  InternalError = require('kuzzle-common-objects').Errors.internalError;

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

  /**
   * Checks, standardizes and converts filters in canonical form
   * @param {Object} filters
   * @return {Promise}
   */
  this.normalize = function (filters) {
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

  return this;
}

module.exports = Transformer;
