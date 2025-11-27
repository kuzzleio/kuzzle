/* eslint-disable @typescript-eslint/no-unused-vars */

import Bluebird from "bluebird";
import WebSocket, { RawData } from "ws";

import WebSocketApiBase from "./websocketBase";

type ApiMessage = Record<string, any>;

type Subscription = {
  channel: string;
  listener: (data: any) => void;
};

class WebSocketApi extends WebSocketApiBase {
  sockets: Record<string, WebSocket>;
  requests: Record<string, (data: any) => void>;
  protected subscribedRooms: Record<string, Record<string, Subscription>>;

  constructor(world: any) {
    super(world);

    this.responses = null;
    this.subscribedRooms = {};

    this.sockets = {};
    this.requests = {};
  }

  get socket(): WebSocket | undefined {
    return this.sockets.client1;
  }

  _initSocket(name = "client1") {
    if (this.sockets[name]) {
      return Bluebird.resolve();
    }

    return new Bluebird<void>((resolve, reject) => {
      const socket = new WebSocket(
        `ws://${this.world.config.host}:${this.world.config.port}`,
        { perMessageDeflate: false },
      );
      this.sockets[name] = socket;

      socket.on("message", (message: RawData) => {
        const payload =
          typeof message === "string" ? message : message.toString();
        const data = JSON.parse(payload);

        if (
          data.scope ||
          data.type === "user" ||
          data.type === "TokenExpired"
        ) {
          if (data.type === "TokenExpired") {
            this.responses = data;
          }

          const channel = data.room;
          const roomId = channel.split("-")[0];
          const rooms = this.subscribedRooms[name];

          if (rooms && rooms[roomId]) {
            const room = rooms[roomId];
            if (room.channel === channel) {
              room.listener(data);
            } else {
              throw new Error("Channels do not match");
            }
          }
        } else if (this.requests[data.requestId]) {
          this.requests[data.requestId](data);
        }
      });
      socket.on("error", reject);
      socket.on("open", resolve);
    });
  }

  _socketOn(
    _socket?: WebSocket,
    _channel?: string,
    _cb?: (message: any) => void,
  ) {
    // handled via the shared "message" listener
  }

  _socketOnce(_socket: WebSocket, requestId: string, cb: (data: any) => void) {
    this.requests[requestId] = cb;
  }

  _socketRemoveListener(
    _socket?: WebSocket,
    _channel?: string,
    _cb?: (message: any) => void,
  ) {
    // handled via the shared "message" listener
  }

  _socketSend(socket: WebSocket, msg: ApiMessage) {
    return socket.send(JSON.stringify(msg), (err) => {
      if (err) {
        throw err;
      }
    });
  }

  disconnect() {
    for (const socketKey of Object.keys(this.sockets)) {
      this.sockets[socketKey].terminate();
      delete this.sockets[socketKey];
    }
  }
}

export default WebSocketApi;
