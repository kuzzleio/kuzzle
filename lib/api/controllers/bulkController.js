var
  q = require('q'),
  PartialError = require('../core/errors/partialError'),
  ResponseObject = require('../core/models/responseObject');

module.exports = function BulkController (kuzzle) {
  /**
   * Perform a bulk import
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.import = function (requestObject) {
    var modifiedRequestObject;

    return kuzzle.pluginsManager.trigger('data:beforeBulkImport', requestObject)
      .then((newRequestObject) => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.workerListener.add(modifiedRequestObject);
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