function WebsocketConnection (socket) {
  construct.call(this, socket);
}

function construct (socket) {
  this.id = socket.id;
}

WebsocketConnection.prototype = Connection;

module.exports = WSConnection;
