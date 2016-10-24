var
  ResponseObject = require('kuzzle-common-objects').Models.responseObject;


/**
 *
 * @param kuzzle
 * @constructor
 */
function WriteController (kuzzle) {
  var engine = kuzzle.services.list.storageEngine;

  /**
   * Create a new document
   *
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.create = function (requestObject) {
    var modifiedRequestObject = null;

    return requestObject.isValid()
      .then(() => {
        return kuzzle.pluginsManager.trigger('data:beforeCreate', requestObject);
      })
      .then(newRequestObject => {
        return kuzzle.validation.validate(newRequestObject);
      })
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        return engine.create(newRequestObject);
      })
      .then(response => {
        kuzzle.notifier.notifyDocumentCreate(modifiedRequestObject, response);
        return kuzzle.pluginsManager.trigger('data:afterCreate', new ResponseObject(requestObject, response));
      });
  };

  /**
   * Publish a realtime message
   *
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.publish = function (requestObject) {
    var modifiedRequestObject = null;

    return requestObject.isValid()
      .then(() => {
        return kuzzle.pluginsManager.trigger('data:beforePublish', requestObject);
      })
      .then(newRequestObject => {
        return kuzzle.validation.validate(newRequestObject);
      })
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        return kuzzle.notifier.publish(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterPublish', new ResponseObject(modifiedRequestObject, response)));
  };

  /**
   * Create a new document through the persistent layer. If it already exists, update it instead.
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.createOrReplace = function (requestObject) {
    var modifiedRequestObject = null;

    return requestObject.isValid()
      .then(() => {
        return kuzzle.pluginsManager.trigger('data:beforeCreateOrReplace', requestObject);
      })
      .then(newRequestObject => {
        return kuzzle.validation.validate(newRequestObject);
      })
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return engine.createOrReplace(newRequestObject);
      })
      .then(response => {
        kuzzle.indexCache.add(modifiedRequestObject.index, modifiedRequestObject.collection);

        if (response.created) {
          kuzzle.notifier.notifyDocumentCreate(modifiedRequestObject, response);
        }
        else {
          kuzzle.notifier.notifyDocumentReplace(modifiedRequestObject);
        }

        return kuzzle.pluginsManager.trigger('data:afterCreateOrReplace', new ResponseObject(modifiedRequestObject, response));
      });
  };

  /**
   * Update a document through the persistent layer
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.update = function (requestObject) {
    var modifiedRequestObject = null;

    return requestObject.isValid()
      .then(function () {
        return kuzzle.pluginsManager.trigger('data:beforeUpdate', requestObject);
      })
      .then(newRequestObject => {
        return kuzzle.validation.validate(newRequestObject);
      })
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return engine.update(modifiedRequestObject);
      })
      .then(response => {
        kuzzle.notifier.notifyDocumentUpdate(modifiedRequestObject);
        return kuzzle.pluginsManager.trigger('data:afterUpdate', new ResponseObject(modifiedRequestObject, response));
      });
  };

  /**
   * Replace a document through the persistent layer. Throws an error if the document doesn't exist
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.replace = function (requestObject) {
    var modifiedRequestObject = null;

    return requestObject.isValid()
      .then(function () {
        return kuzzle.pluginsManager.trigger('data:beforeReplace', requestObject);
      })
      .then(newRequestObject => {
        return kuzzle.validation.validate(newRequestObject);
      })
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return engine.replace(modifiedRequestObject);
      })
      .then(response => {
        kuzzle.notifier.notifyDocumentReplace(modifiedRequestObject);
        return kuzzle.pluginsManager.trigger('data:afterReplace', new ResponseObject(modifiedRequestObject, response));
      });
  };

  /**
   * Delete a document through the persistent layer
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.delete = function (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeDelete', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return engine.delete(modifiedRequestObject);
      })
      .then(response => {
        kuzzle.notifier.notifyDocumentDelete(modifiedRequestObject, [response._id]);
        return kuzzle.pluginsManager.trigger('data:afterDelete', new ResponseObject(modifiedRequestObject, response));
      });
  };

  /**
   * Delete several documents matching a filter through the persistent layer
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.deleteByQuery = function (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeDeleteByQuery', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return engine.deleteByQuery(newRequestObject);
      })
      .then(response => {
        kuzzle.notifier.notifyDocumentDelete(modifiedRequestObject, response.ids);
        return kuzzle.pluginsManager.trigger('data:afterDeleteByQuery', new ResponseObject(modifiedRequestObject, response));
      });
  };

  /**
   * Creates a new collection. Does nothing if the collection already exists.
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.createCollection = function (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeCreateCollection', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return engine.createCollection(modifiedRequestObject);
      })
      .then(response => {
        kuzzle.indexCache.add(modifiedRequestObject.index, modifiedRequestObject.collection);
        return kuzzle.pluginsManager.trigger('data:afterCreateCollection', new ResponseObject(modifiedRequestObject, response));
      });
  };

  /**
   * Validate a document against collection validation specifications.
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.validateDocument = function (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeValidateDocument', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.validation.validationPromise(modifiedRequestObject, true);
      })
      .then(response => {
        var responseObject = new ResponseObject(modifiedRequestObject, response);

        if (!response.validation) {
          responseObject.status = 400;
          responseObject.error = response.errorMessages;
        }
        kuzzle.pluginsManager.trigger('log:error', `The document does not comply with the ${requestObject.index} / ${requestObject.collection} : ${JSON.stringify(requestObject.data.body)}`);

        return kuzzle.pluginsManager.trigger('data:afterValidateDocument', responseObject);
      });
  };
}

module.exports = WriteController;
