function RealTimeResponseObject (roomId, requestObject, count) {

  this.roomId = roomId;
  this.roomName = this.requestId = requestObject.requestId;
  this.controller = requestObject.controller;
  this.action = requestObject.action;
  this.count = count;

}

RealTimeResponseObject.prototype.toJson = function () {
  var object = {error: null};

  if (this.count) {
    object.result = this.count;
  }
  else {
    object.result = {
      roomId: this.roomId,
      roomName: this.roomName
    };
  }

  return object;
};

module.exports = RealTimeResponseObject;