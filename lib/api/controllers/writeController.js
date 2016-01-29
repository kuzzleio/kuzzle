module.exports = function WriteController (kuzzle) {
  /**
   * Create a new document
   *
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.create = function (requestObject) {
    return requestObject.isValid()
      .then(() => {
        kuzzle.pluginsManager.trigger('data:create', requestObject);
        return kuzzle.workerListener.add(requestObject);
      });
  };

  /**
   * Publish a realtime message
   *
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.publish = function (requestObject) {
    return requestObject.isValid()
      .then(() => {
        kuzzle.pluginsManager.trigger('data:publish', requestObject);
        return kuzzle.notifier.publish(requestObject);
      });
  };

  /**
   * Create a new document through the persistent layer. If it already exists, update it instead.
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.createOrUpdate = function (requestObject) {
    return requestObject.isValid()
      .then(function () {
        kuzzle.pluginsManager.trigger('data:createOrUpdate', requestObject);
        return kuzzle.workerListener.add(requestObject);
      });
  };

  /**
   * Update a document through the persistent layer
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.update = function (requestObject) {
    return requestObject.isValid()
      .then(function () {
        kuzzle.pluginsManager.trigger('data:update', requestObject);
        return kuzzle.workerListener.add(requestObject);
      });
  };

  /**
   * Replace a document through the persistent layer. Throws an error if the document doesn't exist
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.replace = function (requestObject) {
    return requestObject.isValid()
      .then(function () {
        kuzzle.pluginsManager.trigger('data:replace', requestObject);
        return kuzzle.workerListener.add(requestObject);
      });
  };

  /**
   * Delete a document through the persistent layer
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.delete = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:delete', requestObject);
    return kuzzle.workerListener.add(requestObject);
  };

  /**
   * Delete several documents matching a filter through the persistent layer
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.deleteByQuery = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:deleteByQuery', requestObject);
    return kuzzle.workerListener.add(requestObject);
  };


  /**
   * Creates a new collection. Does nothing if the collection already exists.
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.createCollection = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:createCollection', requestObject);
    return kuzzle.workerListener.add(requestObject);
  };
};
