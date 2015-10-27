function WebsocketConnection (socket) {
  this.type = 'websocket';
  this.socket = socket;
  this.id = socket.id;
}

module.exports = WebsocketConnection;
