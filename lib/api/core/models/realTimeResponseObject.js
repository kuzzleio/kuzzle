function RealTimeResponseObject (roomId, requestObject, count) {

  this.roomId = roomId;
  this.requestId = requestObject.requestId;
  this.controller = requestObject.controller;
  this.action = requestObject.action;
  this.protocol = requestObject.protocol;
  this.count = count;
  this.timestamp = requestObject.timestamp;
  this.metadata = requestObject.metadata;

}

RealTimeResponseObject.prototype.toJson = function () {
  var object = {
    error: null,
    status: 200,
    result: {
      roomId: this.roomId,
      requestId: this.requestId,
      controller: this.controller,
      action: this.action,
      protocol: this.protocol,
      timestamp: this.timestamp,
      metadata: this.metadata
    }
  };

  if (this.count) {
    object.result.count = this.count;
  }

  return object;
};

module.exports = RealTimeResponseObject;