/**
 * Builds a HTTP response object
 *
 * @param {string} id - request id
 * @param {number} status - HTTP status code
 * @param {object} content
 * @constructor
 */
function HttpResponse(id, status, content) {
  this.id = id;
  this.content = content;
  this.status = status;

  return this;
}

HttpResponse.prototype.getResponse = function getResponse () {
  return {
    requestId: this.id,
    response: this.content,
    status: this.status
  };
};


module.exports = HttpResponse;
