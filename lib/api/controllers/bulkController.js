'use strict';

var
  PartialError = require('kuzzle-common-objects').errors.PartialError,
  assertHasBody = require('./util/requestAssertions').assertHasBody,
  assertHasBodyHasAttribute = require('./util/requestAssertions').assertHasBodyHasAttribute;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function BulkController (kuzzle) {
  var engine = kuzzle.services.list.storageEngine;

  /**
   * Perform a bulk import
   *
   * @param {Request} request
   * @returns {Promise}
   */
  this.import = function bulkImport (request) {
    assertHasBody(request, 'bulk:import');
    assertHasBodyHasAttribute(request, 'bulkData', 'bulk:import');

    return engine.import(request)
      .then(response => {
        if (response.partialErrors && response.partialErrors.length > 0) {
          request.setError(new PartialError('Some errors with provided rooms', response.partialErrors));
        }

        return Promise.resolve(response);
      });
  };
}

module.exports = BulkController;
