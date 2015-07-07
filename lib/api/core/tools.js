module.exports = {
  /**
   * Clean information we don't want to send to the final user
   * @param {Object} object an object to clean
   * @returns {Object} the cleaned object
   */
  cleanProperties: function (object) {
    if (object.result) {
      delete object.result.internalId;
    }

    delete object.internalId;

    return object;
  }
};