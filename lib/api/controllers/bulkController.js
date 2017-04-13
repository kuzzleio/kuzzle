'use strict';

var
  PartialError = require('kuzzle-common-objects').errors.PartialError,
  assertHasBody = require('../../util/requestAssertions').assertHasBody,
  assertBodyHasAttribute = require('../../util/requestAssertions').assertBodyHasAttribute,
  getRequestRoute = require('../../util/string').getRequestRoute;

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
    assertHasBody(request);
    assertBodyHasAttribute(request, 'bulkData');

    return engine.import(request)
      .then(response => {
        if (response.partialErrors && response.partialErrors.length > 0) {
          request.setError(new PartialError(`${getRequestRoute(request)} Some data was not imported`, response.partialErrors));
        }

        return response;
      });
  };
}

module.exports = BulkController;
