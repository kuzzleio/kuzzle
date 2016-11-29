/**
 * Creates a notification response from a given room, request object, and content.
 *
 * Expected content members:
 *   - scope: [in|out] - sets the notification scope. Default: undefined
 *   - state: [pending|done] - sets the notification state. Default: undefined
 *   - action: overrides the request action
 *   - All other keys will be added to the "result" part of this notification object
 *
 * @param {string} roomId - target room identifier
 * @param {Request} request - the request object from which the notification is issued
 * @param {object} content - notification content
 * @constructor
 */
function NotificationObject(roomId, request, content) {
  content = content || {};

  this.roomId = roomId;
  this.requestId = request.id;
  this.index = request.input.resource.index;
  this.collection = request.input.resource.collection;
  this.controller = request.input.controller;
  this.action = content.action || request.input.action;
  this.protocol = request.context.protocol;
  this.timestamp = request.timestamp;
  this.metadata = request.input.metadata;
  this.result = {};

  // Handling content
  this.scope = content.scope || undefined;
  this.state = content.state || undefined;

  Object.keys(content)
    .filter(key => ['scope', 'state', 'action'].indexOf(key) === -1)
    .forEach(key => { this.result[key] = content[key]; });
}

NotificationObject.prototype.toJson = function notificationToJson () {
  var object = {
    error: null,
    status: 200,
    roomId: this.roomId,
    requestId: this.requestId,
    index: this.index,
    collection: this.collection,
    controller: this.controller,
    action: this.action,
    protocol: this.protocol,
    timestamp: this.timestamp,
    metadata: this.metadata,
    scope: this.scope,
    state: this.state
  };

  if (Object.keys(this.result).length > 0) {
    object.result = this.result;
  }

  return object;
};

module.exports = NotificationObject;
