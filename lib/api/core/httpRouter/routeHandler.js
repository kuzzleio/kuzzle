/**
 * Object returned by routePart.getHandler(),
 * containing the information gathered about
 * a requested route and the corresponding handler
 * to invoke
 * @constructor
 */
function RouteHandler() {
  this.handler = null;
  this.args = {};
}

/**
 * @type {RouteHandler}
 */
module.exports = RouteHandler;
