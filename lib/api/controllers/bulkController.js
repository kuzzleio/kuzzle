'use strict';

var
  PartialError = require('kuzzle-common-objects').errors.PartialError,
  assertBody = require('./util/requestAssertions').assertBody,
  assertBodyAttribute = require('./util/requestAssertions').assertBodyAttribute;

module.exports = function BulkController (kuzzle) {
  var engine = kuzzle.services.list.storageEngine;

  /**
   * Perform a bulk import
   *
   * @param {Request} request
   * @returns {Promise}
   */
  this.import = function bulkImport (request) {
    assertBody(request, 'import');
    assertBodyAttribute(request, 'bulkData', 'import');

    return engine.import(request)
      .then(response => {
        if (response.partialErrors && response.partialErrors.length > 0) {
          request.setError(new PartialError('Some errors with provided rooms', response.partialErrors));
        }

        return Promise.resolve(response);
      });
  };

};
