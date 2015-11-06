function RealTimeResponseObject (roomId, requestObject, count) {

  this.roomId = roomId;
  this.controller = requestObject.controller;
  this.action = requestObject.action;
  this.protocol = requestObject.protocol;
  this.count = count;
  this.timestamp = requestObject.timestamp;
  this.metadata = requestObject.metadata;

}

RealTimeResponseObject.prototype.toJson = function () {
  var object = {error: null, status: 200};

  if (this.count) {
    object.result = this.count;
  }
  else {
    object.result = {
      roomId: this.roomId
    };
  }

  return object;
};

module.exports = RealTimeResponseObject;