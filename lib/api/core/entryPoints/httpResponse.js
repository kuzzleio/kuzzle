/**
 * Builds a HTTP response object
 *
 * @param {string} id - request id
 * @param {string} type - HTTP content type
 * @param {number} status - HTTP status code
 * @param {Object} content
 * @constructor
 */
function HttpResponse(id, type, status, content) {
  this.id = id;
  this.type = type;
  this.content = content;
  this.status = status;

  return this;
}

HttpResponse.prototype.getResponse = function getResponse () {
  return {
    requestId: this.id,
    response: this.content,
    type: this.type,
    status: this.status
  };
};


module.exports = HttpResponse;
