"use strict";

const Bluebird = require("bluebird"),
  ApiBase = require("./apiBase"),
  uuid = require("uuid");

class WebSocketApiBase extends ApiBase {
  _socketOnce() {
    throw new Error("not implemented");
  }

  _socketSend() {
    throw new Error("not implemented");
  }

  send(msg, getAnswer = true, socketName = "client1") {
    if (!msg.requestId) {
      msg.requestId = uuid.v4();
    }

    msg.volatile = this.world.volatile;

    if (this.world.currentUser && this.world.currentUser.token) {
      msg.jwt = this.world.currentUser.token;
    }

    return this._initSocket(socketName).then(() => {
      const socket = this.sockets[socketName];

      let promise = Bluebird.resolve({});
      if (getAnswer) {
        promise = new Bluebird((resolve, reject) => {
          this._socketOnce(socket, msg.requestId, (result) => {
            if (!result) {
              const error = new Error("Returned result is null");
              return reject(Object.assign(error, msg));
            }

            if (result.error && result.status !== 206) {
              const error = new Error(result.error.stack);
              Object.assign(error, result);

              // used to fit with rest api (used with request-promise)
              error.details = result.error._source || {};
              error.statusCode = result.status;
              return reject(error);
            }

            resolve(result);
          });
        });
      }

      this._socketSend(socket, msg);

      return promise;
    });
  }

  sendAndListen(msg, socketName = "client1") {
    if (!msg.requestId) {
      msg.requestId = uuid.v4();
    }

    msg.volatile = this.world.volatile;

    if (this.world.currentUser && this.world.currentUser.token) {
      msg.jwt = this.world.currentUser.token;
    }

    return this._initSocket(socketName).then(() => {
      const socket = this.sockets[socketName];

      let promise = new Bluebird((resolve, reject) => {
        this._socketOnce(socket, msg.requestId, (response) => {
          const listener = (document) => {
            this.responses = document;
          };

          if (response.error) {
            return reject(response.error.message);
          }

          if (!this.subscribedRooms[socketName]) {
            this.subscribedRooms[socketName] = {};
          }

          this.subscribedRooms[socketName][response.result.roomId] = {
            channel: response.result.channel,
            listener,
          };
          this._socketOn(socket, response.result.channel, (document) =>
            listener(document)
          );
          resolve(response);
        });
      });

      this._socketSend(socket, msg);

      return promise;
    });
  }

  unsubscribe(roomId, socketName, waitForResponse = false) {
    const msg = {
      controller: "realtime",
      action: "unsubscribe",
      collection: this.world.fakeCollection,
      index: this.world.fakeIndex,
      body: { roomId: roomId },
    };

    const socket = this.sockets[socketName];
    if (!socket) {
      return;
    }

    const room = this.subscribedRooms[socketName][roomId];

    this._socketRemoveListener(socket, room.channel, room.listen);
    delete this.subscribedRooms[socketName][room];
    this.responses = null;

    return this.send(msg, waitForResponse, socketName);
  }

  unsubscribeAll() {
    const promises = [];

    for (const socketName of Object.keys(this.subscribedRooms)) {
      for (const roomId of Object.keys(this.subscribedRooms[socketName])) {
        promises.push(this.unsubscribe(roomId, socketName, true));
      }
    }

    return Bluebird.all(promises);
  }
}

module.exports = WebSocketApiBase;
