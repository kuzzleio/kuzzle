var
  PartialError = require('kuzzle-common-objects').Errors.partialError,
  ResponseObject = require('kuzzle-common-objects').Models.responseObject;

module.exports = function BulkController (kuzzle) {
  var engine = kuzzle.services.list.storageEngine;

  /**
   * Perform a bulk import
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.import = function bulkImport (requestObject) {
    var modifiedRequestObject;

    return kuzzle.pluginsManager.trigger('data:beforeBulkImport', requestObject)
      .then((newRequestObject) => {
        modifiedRequestObject = newRequestObject;
        return engine.import(modifiedRequestObject);
      })
      .then(response => {
        var responseObject = new ResponseObject(modifiedRequestObject, response);

        if (response.partialErrors && response.partialErrors.length > 0) {
          responseObject.error = new PartialError('Some errors on bulk', response.partialErrors);
          responseObject.status = responseObject.error.status;
        }

        return kuzzle.pluginsManager.trigger('data:afterBulkImport', responseObject);
      });
  };

};
