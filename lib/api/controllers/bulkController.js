var
  PartialError = require('kuzzle-common-objects').errors.PartialError;

module.exports = function BulkController (kuzzle) {
  var engine = kuzzle.services.list.storageEngine;

  /**
   * Perform a bulk import
   *
   * @param {KuzzleRequest} request
   * @returns {Promise}
   */
  this.import = function bulkImport (request) {
    return engine.import(request)
      .then(response => {
        // TODO refactor
        if (response.partialErrors && response.partialErrors.length > 0) {
          request.setError(new PartialError('Some errors with provided rooms', response.partialErrors));
        }

        return Promise.resolve(response);
      });
  };

};
