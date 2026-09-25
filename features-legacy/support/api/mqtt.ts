// TODO modify the syntax to be typescript

import Bluebird from "bluebird";
import mqtt, { MqttClient } from "mqtt";
import { v4 as uuidv4 } from "uuid";

import ApiBase from "./apiBase";

type ApiMessage = Record<string, any>;

type Subscription = {
  channel: string;
  listener: (document: any) => void;
};

export default class MqttApi extends ApiBase {
  private clients: Record<string, MqttClient>;
  private requests: Record<string, (result: any) => void>;
  protected subscribedRooms: Record<string, Record<string, Subscription>>;

  constructor(world: any) {
    super(world);

    this.clients = {};
    this.requests = {};
    this.subscribedRooms = {};
  }

  disconnect() {
    for (const k of Object.keys(this.clients)) {
      this.clients[k].end();
    }
  }

  send(msg: ApiMessage, getAnswer = true, clientName = "client1") {
    if (!msg.requestId) {
      msg.requestId = uuidv4();
    }

    msg.volatile = this.world.volatile;

    if (this.world.currentUser && this.world.currentUser.token) {
      msg.jwt = this.world.currentUser.token;
    }

    return this._getClient(clientName).then((client) => {
      let promise: Bluebird<any> = Bluebird.resolve({});
      if (getAnswer) {
        promise = new Bluebird((resolve, reject) => {
          this.requests[msg.requestId] = (result) => {
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
          };
        });
      }

      client.publish("Kuzzle/request", JSON.stringify(msg));

      return promise;
    });
  }

  sendAndListen(msg: ApiMessage, clientName = "client1") {
    if (!msg.requestId) {
      msg.requestId = uuidv4();
    }

    msg.volatile = this.world.volatile;

    return this._getClient(clientName).then((client) => {
      const promise = new Bluebird((resolve, reject) => {
        this.requests[msg.requestId] = (response) => {
          const listener = (document) => {
            this.responses = document;
          };

          if (response.error) {
            return reject(response.error.message);
          }

          if (!this.subscribedRooms[clientName]) {
            this.subscribedRooms[clientName] = {};
          }
          this.subscribedRooms[clientName][response.result.roomId] = {
            channel: response.result.channel,
            listener,
          };
          client.subscribe(response.result.channel);

          resolve(response);
        };
      });

      client.publish("Kuzzle/request", JSON.stringify(msg));

      return promise;
    });
  }

  _getClient(name: string) {
    if (this.clients[name]) {
      return Bluebird.resolve(this.clients[name]);
    }

    return new Bluebird<MqttClient>((resolve, reject) => {
      const client = mqtt.connect({ host: this.world.config.host });
      this.clients[name] = client;

      client.on("error", reject);
      client.on("connect", () => resolve(client));
      client.on("message", (topic: string, raw: Buffer) => {
        const message = JSON.parse(raw.toString());

        if (topic === "Kuzzle/response") {
          if (this.requests[message.requestId]) {
            this.requests[message.requestId](message);
          }
        } else {
          if (message.type === "TokenExpired") {
            this.responses = message;
          }
          // notification
          const channel = topic;
          const roomId = topic.split("-")[0];

          if (
            this.subscribedRooms[name] &&
            this.subscribedRooms[name][roomId]
          ) {
            const room = this.subscribedRooms[name][roomId];
            if (room.channel === channel) {
              room.listener(message);
            } else {
              throw new Error("Channels do not match");
            }
          }
        }
      });
    });
  }

  unsubscribe(roomId: string, clientName: string, waitForResponse = false) {
    const client = this.clients[clientName];
    if (!client) {
      return;
    }

    const room = this.subscribedRooms[clientName][roomId];
    client.unsubscribe(room.channel);
    delete this.subscribedRooms[clientName][roomId];

    return this.send(
      {
        action: "unsubscribe",
        body: { roomId },
        collection: this.world.fakeCollection,
        controller: "realtime",
        index: this.world.fakeIndex,
      },
      waitForResponse,
      clientName,
    );
  }

  unsubscribeAll() {
    const promises: Array<ReturnType<typeof this.unsubscribe>> = [];

    for (const clientName of Object.keys(this.subscribedRooms)) {
      for (const roomId of Object.keys(this.subscribedRooms[clientName])) {
        promises.push(this.unsubscribe(roomId, clientName, true));
      }
    }

    return Bluebird.all(promises);
  }
}
