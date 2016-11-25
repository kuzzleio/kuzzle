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
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.create = function writeCreate (requestObject, userContext) {
    requestObject.userId = userContext.token.userId;

    return kuzzle.validation.validate(requestObject)
      .then(modifiedRequestObject => {
        requestObject = modifiedRequestObject;

        return engine.create(requestObject);
      })
      .then(response => {
        kuzzle.notifier.notifyDocumentCreate(requestObject, response);

        return Promise.resolve({
          responseObject: new ResponseObject(requestObject, response),
          userContext: userContext
        });
      });
  };

  /**
   * Publish a realtime message
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.publish = function writePublish (requestObject, userContext) {
    return kuzzle.validation.validate(requestObject)
      .then(modifiedRequestObject => {
        requestObject = modifiedRequestObject;

        return kuzzle.notifier.publish(requestObject);
      })
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext
      }));
  };

  /**
   * Create a new document through the persistent layer. If it already exists, update it instead.
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.createOrReplace = function writeCreateOrReplace (requestObject, userContext) {
    return kuzzle.validation.validate(requestObject)
      .then(modifiedRequestObject => {
        requestObject = modifiedRequestObject;

        return engine.createOrReplace(requestObject);
      })
      .then(response => {
        kuzzle.indexCache.add(requestObject.index, requestObject.collection);

        if (response.created) {
          kuzzle.notifier.notifyDocumentCreate(requestObject, response);
        }
        else {
          kuzzle.notifier.notifyDocumentReplace(requestObject);
        }

        return Promise.resolve({
          responseObject: new ResponseObject(requestObject, response),
          userContext
        });
      });
  };

  /**
   * Update a document through the persistent layer
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.update = function writeUpdate (requestObject, userContext) {
    requestObject.userId = userContext.token.userId;

    return kuzzle.validation.validate(requestObject)
      .then(modifiedRequestObject => {
        requestObject = modifiedRequestObject;

        return engine.update(requestObject);
      })
      .then(response => {
        kuzzle.notifier.notifyDocumentUpdate(requestObject);

        return Promise.resolve({
          responseObject: new ResponseObject(requestObject, response),
          userContext
        });
      });
  };

  /**
   * Replace a document through the persistent layer. Throws an error if the document doesn't exist
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.replace = function writeReplace (requestObject, userContext) {
    return kuzzle.validation.validate(requestObject)
      .then(modifiedRequestObject => {
        requestObject = modifiedRequestObject;

        return engine.replace(requestObject);
      })
      .then(response => {
        kuzzle.notifier.notifyDocumentReplace(requestObject);

        return Promise.resolve({
          responseObject: new ResponseObject(requestObject, response),
          userContext
        });
      });
  };

  /**
   * Delete a document through the persistent layer
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.delete = function writeDelete (requestObject, userContext) {
    return engine.delete(requestObject)
      .then(response => {
        kuzzle.notifier.notifyDocumentDelete(requestObject, [response._id]);

        return Promise.resolve({
          responseObject: new ResponseObject(requestObject, response),
          userContext
        });
      });
  };

  /**
   * Delete several documents matching a query through the persistent layer
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.deleteByQuery = function writeDeleteByQuery (requestObject, userContext) {
    return engine.deleteByQuery(requestObject)
      .then(response => {
        kuzzle.notifier.notifyDocumentDelete(requestObject, response.ids);

        return Promise.resolve({
          responseObject: new ResponseObject(requestObject, response),
          userContext
        });
      });
  };

  /**
   * Creates a new collection. Does nothing if the collection already exists.
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.createCollection = function writeCreateCollection (requestObject, userContext) {
    return engine.createCollection(requestObject)
      .then(response => {
        kuzzle.indexCache.add(requestObject.index, requestObject.collection);

        return kuzzle.pluginsManager.trigger('write:afterCreateCollection', {
          responseObject: new ResponseObject(requestObject, response),
          userContext: userContext
        });
      });
  };

  /**
   * Validate a document against collection validation specifications.
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.validate = function writeValidate (requestObject, userContext) {
    return kuzzle.validation.validationPromise(requestObject, true)
      .then(response => {
        var responseObject = new ResponseObject(requestObject, response);

        if (!response.valid) {
          responseObject.status = 200;
          responseObject.error = response.errorMessages;
        }
        kuzzle.pluginsManager.trigger('validation:error', `The document does not comply with the ${requestObject.index} / ${requestObject.collection} : ${JSON.stringify(requestObject.data.body)}`);

        return Promise.resolve({
          responseObject,
          userContext
        });
      });
  };
}

module.exports = WriteController;
