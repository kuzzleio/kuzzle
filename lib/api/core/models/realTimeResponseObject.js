function RealTimeResponseObject (roomId, roomName) {

  this.roomId = roomId;
  this.roomName = roomName;

}

RealTimeResponseObject.prototype.toJson = function () {
  return {
    error: null,
    result: this.roomId
  };
};

module.exports = RealTimeResponseObject;