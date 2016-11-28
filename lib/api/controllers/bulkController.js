var
  PartialError = require('kuzzle-common-objects').Errors.partialError,
  ResponseObject = require('kuzzle-common-objects').Models.responseObject;

module.exports = function BulkController (kuzzle) {
  var engine = kuzzle.services.list.storageEngine;

  /**
   * Perform a bulk import
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.import = function bulkImport (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeBulkImport', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return engine.import(modifiedData.requestObject);
      })
      .then(response => {
        var responseObject = new ResponseObject(modifiedData.requestObject, response);

        if (response.partialErrors && response.partialErrors.length > 0) {
          responseObject.error = new PartialError('Some errors on bulk', response.partialErrors);
          responseObject.status = responseObject.error.status;
        }

        return kuzzle.pluginsManager.trigger('data:afterBulkImport', {
          responseObject,
          userContext: modifiedData.userContext
        });
      });
  };

};
