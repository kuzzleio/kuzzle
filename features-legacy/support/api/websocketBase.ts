import Bluebird from "bluebird";
import { v4 as uuidv4 } from "uuid";

import ApiBase from "./apiBase";

type ApiMessage = Record<string, any>;

type Subscription = {
  channel: string;
  listener: (document: any) => void;
};

abstract class WebSocketApiBase extends ApiBase {
  protected sockets!: Record<string, any>;
  protected subscribedRooms!: Record<string, Record<string, Subscription>>;

  protected abstract _initSocket(name?: string): Bluebird<void>;

  protected abstract _socketOnce(
    socket: any,
    requestId: string,
    cb: (result: any) => void,
  ): void;

  protected abstract _socketOn(
    socket: any,
    channel: string,
    cb: (message: any) => void,
  ): void;

  protected abstract _socketSend(socket: any, msg: ApiMessage): any;

  protected abstract _socketRemoveListener(
    socket: any,
    channel: string,
    cb: (message: any) => void,
  ): void;

  send(msg: ApiMessage, getAnswer = true, socketName = "client1") {
    if (!msg.requestId) {
      msg.requestId = uuidv4();
    }

    msg.volatile = this.world.volatile;

    if (this.world.currentUser && this.world.currentUser.token) {
      msg.jwt = this.world.currentUser.token;
    }

    return this._initSocket(socketName).then(() => {
      const socket = this.sockets[socketName];

      let promise: Bluebird<any> = Bluebird.resolve({});
      if (getAnswer) {
        promise = new Bluebird((resolve, reject) => {
          this._socketOnce(socket, msg.requestId, (result) => {
            if (!result) {
              const error = new Error("Returned result is null");
              return reject(Object.assign(error, msg));
            }

            if (result.error && result.status !== 206) {
              const error: any = new Error(result.error.stack);
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

  sendAndListen(msg: ApiMessage, socketName = "client1") {
    if (!msg.requestId) {
      msg.requestId = uuidv4();
    }

    msg.volatile = this.world.volatile;

    if (this.world.currentUser && this.world.currentUser.token) {
      msg.jwt = this.world.currentUser.token;
    }

    return this._initSocket(socketName).then(() => {
      const socket = this.sockets[socketName];

      const promise = new Bluebird((resolve, reject) => {
        this._socketOnce(socket, msg.requestId, (response) => {
          const listener = (document: any) => {
            this.responses = document;
          };

          if (response.error) {
            return reject(response.error.message);
          }

          const rooms =
            this.subscribedRooms[socketName] ||
            (this.subscribedRooms[socketName] = {});

          rooms[response.result.roomId] = {
            channel: response.result.channel,
            listener,
          };
          this._socketOn(socket, response.result.channel, listener);
          resolve(response);
        });
      });

      this._socketSend(socket, msg);

      return promise;
    });
  }

  unsubscribe(roomId: string, socketName: string, waitForResponse = false) {
    const msg: ApiMessage = {
      action: "unsubscribe",
      body: { roomId },
      collection: this.world.fakeCollection,
      controller: "realtime",
      index: this.world.fakeIndex,
    };

    const socket = this.sockets[socketName];
    if (!socket) {
      return;
    }

    const rooms = this.subscribedRooms[socketName];
    if (!rooms) {
      return;
    }

    const room = rooms[roomId];
    if (!room) {
      return;
    }

    this._socketRemoveListener(socket, room.channel, room.listener);
    delete rooms[roomId];
    this.responses = null;

    return this.send(msg, waitForResponse, socketName);
  }

  unsubscribeAll() {
    const promises: Array<ReturnType<typeof this.unsubscribe>> = [];

    for (const socketName of Object.keys(this.subscribedRooms)) {
      for (const roomId of Object.keys(this.subscribedRooms[socketName])) {
        promises.push(this.unsubscribe(roomId, socketName, true));
      }
    }

    return Bluebird.all(promises);
  }
}

export default WebSocketApiBase;
