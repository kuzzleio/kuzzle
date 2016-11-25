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
    var
      modifiedData = null;

    requestObject.userId = userContext.token.userId;

    return requestObject.isValid()
      .then(() => {
        return kuzzle.pluginsManager.trigger('data:beforeCreate', {requestObject, userContext});
      })
      .then(data => {
        modifiedData = data;

        return kuzzle.validation.validate(modifiedData.requestObject);
      })
      .then(modifiedRequestObject => {
        modifiedData.requestObject = modifiedRequestObject;

        return engine.create(modifiedData.requestObject);
      })
      .then(response => {
        kuzzle.notifier.notifyDocumentCreate(modifiedData.requestObject, response);

        return kuzzle.pluginsManager.trigger('data:afterCreate', {
          responseObject: new ResponseObject(modifiedData.requestObject, response),
          userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return requestObject.isValid()
      .then(() => {
        return kuzzle.pluginsManager.trigger('data:beforePublish', {requestObject, userContext});
      })
      .then(data => {
        modifiedData = data;

        return kuzzle.validation.validate(modifiedData.requestObject);
      })
      .then(modifiedRequestObject => {
        modifiedData.requestObject = modifiedRequestObject;

        return kuzzle.notifier.publish(modifiedData.requestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterPublish', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return requestObject.isValid()
      .then(() => {
        return kuzzle.pluginsManager.trigger('data:beforeCreateOrReplace', {requestObject, userContext});
      })
      .then(data => {
        modifiedData = data;

        return kuzzle.validation.validate(modifiedData.requestObject);
      })
      .then(modifiedRequestObject => {
        modifiedData.requestObject = modifiedRequestObject;

        return engine.createOrReplace(modifiedData.requestObject);
      })
      .then(response => {
        kuzzle.indexCache.add(modifiedData.requestObject.index, modifiedData.requestObject.collection);

        if (response.created) {
          kuzzle.notifier.notifyDocumentCreate(modifiedData.requestObject, response);
        }
        else {
          kuzzle.notifier.notifyDocumentReplace(modifiedData.requestObject);
        }

        return kuzzle.pluginsManager.trigger('data:afterCreateOrReplace', {
          responseObject: new ResponseObject(modifiedData.requestObject, response),
          userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    requestObject.userId = userContext.token.userId;

    return requestObject.isValid()
      .then(() => {
        return kuzzle.pluginsManager.trigger('data:beforeUpdate', {requestObject, userContext});
      })
      .then(data => {
        modifiedData = data;

        return kuzzle.validation.validate(modifiedData.requestObject);
      })
      .then(modifiedRequestObject => {
        modifiedData.requestObject = modifiedRequestObject;

        return engine.update(modifiedData.requestObject);
      })
      .then(response => {
        kuzzle.notifier.notifyDocumentUpdate(modifiedData.requestObject);

        return kuzzle.pluginsManager.trigger('data:afterUpdate', {
          responseObject: new ResponseObject(modifiedData.requestObject, response),
          userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return requestObject.isValid()
      .then(() => {
        return kuzzle.pluginsManager.trigger('data:beforeReplace', {requestObject, userContext});
      })
      .then(data => {
        modifiedData = data;

        return kuzzle.validation.validate(modifiedData.requestObject);
      })
      .then(modifiedRequestObject => {
        modifiedData.requestObject = modifiedRequestObject;

        return engine.replace(modifiedData.requestObject);
      })
      .then(response => {
        kuzzle.notifier.notifyDocumentReplace(modifiedData.requestObject);

        return kuzzle.pluginsManager.trigger('data:afterReplace', {
          responseObject: new ResponseObject(modifiedData.requestObject, response),
          userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeDelete', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return engine.delete(modifiedData.requestObject);
      })
      .then(response => {
        kuzzle.notifier.notifyDocumentDelete(modifiedData.requestObject, [response._id]);

        return kuzzle.pluginsManager.trigger('data:afterDelete', {
          responseObject: new ResponseObject(modifiedData.requestObject, response),
          userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeDeleteByQuery', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return engine.deleteByQuery(modifiedData.requestObject);
      })
      .then(response => {
        kuzzle.notifier.notifyDocumentDelete(modifiedData.requestObject, response.ids);

        return kuzzle.pluginsManager.trigger('data:afterDeleteByQuery', {
          responseObject: new ResponseObject(modifiedData.requestObject, response),
          userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeCreateCollection', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return engine.createCollection(modifiedData.requestObject);
      })
      .then(response => {
        kuzzle.indexCache.add(modifiedData.requestObject.index, modifiedData.requestObject.collection);

        return kuzzle.pluginsManager.trigger('data:afterCreateCollection', {
          responseObject: new ResponseObject(modifiedData.requestObject, response),
          userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeValidateDocument', {requestObject, userContext})
      .then(data => {
        modifiedData = data;
        return kuzzle.validation.validationPromise(modifiedData.requestObject, true);
      })
      .then(response => {
        var responseObject = new ResponseObject(modifiedData.requestObject, response);

        if (!response.validation) {
          responseObject.status = 200;
          responseObject.error = response.errorMessages;
        }
        kuzzle.pluginsManager.trigger('validation:error', `The document does not comply with the ${requestObject.index} / ${requestObject.collection} : ${JSON.stringify(requestObject.data.body)}`);

        return kuzzle.pluginsManager.trigger('data:afterValidateDocument', {
          responseObject,
          userContext: modifiedData.userContext
        });
      });
  };
}

module.exports = WriteController;
