function RealTimeResponseObject (roomId, requestObject, additionalData) {

  this.roomId = roomId;
  this.channel = additionalData && additionalData.channel ? additionalData.channel : null;
  this.requestId = requestObject.requestId;
  this.controller = requestObject.controller;
  this.action = requestObject.action;
  this.protocol = requestObject.protocol;
  this.count = additionalData && additionalData.count ? additionalData.count : null;
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

  if (this.channel) {
    object.result.channel = this.channel;
  }

  return object;
};

module.exports = RealTimeResponseObject;