/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// bare specifiers on purpose: the Mocha specs intercept "net" and
// "worker_threads" with mock-require, which never sees a "node:" prefix
import * as net from "net";

import Aedes, {
  AedesPublishPacket,
  Client,
  PublishPacket,
  Subscription,
} from "aedes";
import { JSONObject } from "kuzzle-sdk";

import { Request } from "../../../api/request";
import { wrap } from "../../../kerror";
import createDebug from "../../../util/debug";
import { removeStacktrace } from "../../../util/stackTrace";
import ClientConnection from "../clientConnection";
import { NetworkEntryPoint } from "../networkEntryPoint";
import Protocol from "./protocol";

const kerror = wrap("network", "mqtt");
const debug = createDebug("kuzzle:network:protocols:mqtt");

/** `server.protocols.mqtt` in the Kuzzle configuration */
interface MqttConfig {
  enabled?: boolean;
  allowPubSub: boolean;
  developmentMode: boolean;
  disconnectDelay: number;
  requestTopic: string;
  responseTopic: string;
  server: {
    port: number;
  };
}

interface MqttNotification {
  channels: string[];
  connectionId?: string;
  payload: JSONObject;
}

class MqttProtocol extends Protocol<MqttConfig> {
  public aedes: Aedes;
  public server: net.Server;
  public connections: Map<Client, ClientConnection>;
  public connectionsById: Map<string, Client>;
  public publishCallback: (error?: Error) => void;

  private logger: ReturnType<typeof global.kuzzle.log.child>;

  constructor() {
    super("mqtt");

    // eslint-disable-next-line new-cap
    this.aedes = new Aedes();
    this.server = net.createServer(this.aedes.handle);

    this.connections = new Map();
    this.connectionsById = new Map();
    this.logger = global.kuzzle.log.child("core:network:protocols:mqtt");

    // needs to be bound to this object's context
    this.publishCallback = (error?: Error) => {
      if (error) {
        this.logger.info(`[MQTT] Publishing message failed: ${error}`);
      }
    };
  }

  async init(entryPoint: NetworkEntryPoint): Promise<boolean> {
    await super.init(null, entryPoint);

    if (this.config.enabled === false) {
      return false;
    }

    debug("initializing MQTT Server with config: %a", this.config);

    this.config = Object.assign(
      {
        allowPubSub: false,
        developmentMode: false,
        disconnectDelay: 250,
        requestTopic: "Kuzzle/request",
        responseTopic: "Kuzzle/response",
        server: {
          port: 1883,
        },
      },
      this.config,
    );

    /*
     * To avoid ill-use of our topics, we need to configure authorizations:
     * "requestTopic": should be publish-only, so no one but this plugin can
     *                 listen to this topic
     * "responseTopic": should be subscribe-only, so no one but this plugin can
     *                  write in it
     */
    this.aedes.authorizePublish = this._authorizePublish.bind(this);
    this.aedes.authorizeSubscribe = this._authorizeSubscribe.bind(this);

    // Message events
    this.aedes.on("client", this.onConnection.bind(this));
    this.aedes.on("clientError", this.onDisconnection.bind(this));
    this.aedes.on("clientDisconnect", this.onDisconnection.bind(this));
    this.aedes.on("publish", this.onMessage.bind(this));

    await new Promise<void>((res) =>
      this.server.listen(this.config.server.port, res),
    );

    return true;
  }

  broadcast(data: MqttNotification): void {
    debug("broadcast %a", data);

    const payload = JSON.stringify(data.payload);

    for (const channel of data.channels) {
      this.aedes.publish(
        { payload, topic: channel } as PublishPacket,
        this.publishCallback,
      );
    }
  }

  disconnect(
    connectionId: string,
    message = "Connection closed by remote host",
  ): void {
    debug("disconnect: connection id: %s, message %s", connectionId, message);

    const client = this.connectionsById.get(connectionId);

    if (client) {
      // aedes' close() takes a callback and nothing else: `message` has never
      // reached the client
      client.close();
    }
  }

  joinChannel(channel: string, connectionId: string) {
    // do nothing
    return { channel, connectionId };
  }

  leaveChannel(channel: string, connectionId: string) {
    // do nothing
    return { channel, connectionId };
  }

  notify(data: MqttNotification): void {
    debug("notify %a", data);

    const client = this.connectionsById.get(data.connectionId);

    if (!client) {
      return;
    }

    const payload = Buffer.from(JSON.stringify(data.payload));

    for (const topic of data.channels) {
      client.publish({ payload, topic } as PublishPacket, this.publishCallback);
    }
  }

  onConnection(client: Client): void {
    debug("onConnection: %s", client.id);

    const connection = new ClientConnection(
      this.name,
      [(client.conn as net.Socket).remoteAddress],
      {},
    );
    this.entryPoint.newConnection(connection);

    this.connections.set(client, connection);
    this.connectionsById.set(connection.id, client);
  }

  onDisconnection(client: Client): void {
    debug("onDisconnection %s", client.id);

    if (this.connections.has(client)) {
      setTimeout(() => {
        const connection = this.connections.get(client);

        if (connection) {
          this.connections.delete(client);
          this.connectionsById.delete(connection.id);
          this.entryPoint.removeConnection(connection.id);
        }
      }, this.config.disconnectDelay);
    }
  }

  onMessage(packet: AedesPublishPacket, client: Client): void {
    if (
      packet.topic !== this.config.requestTopic ||
      packet.payload === null ||
      client.id === null
    ) {
      return;
    }

    const connection = this.connections.get(client);

    if (connection === undefined) {
      debug(
        "no connection id for client id %s - packet: %o",
        client.id,
        packet,
      );
      this.logger.error(
        `[MQTT] Received a packet from an unregistered client: ${client.id}`,
      );
      return;
    }

    try {
      const payload = JSON.parse(packet.payload.toString());

      debug("onMessage payload: %o", payload);

      const request = new Request(payload, { connection });

      this.entryPoint.execute(connection, request, (response) =>
        this._respond(client, response),
      );
    } catch (error) {
      this._respondError(client, error);
    }
  }

  _respond(client: Client, response: JSONObject): void {
    debug("sending response: %o", response.content);

    if (global.NODE_ENV === "development" && this.config.developmentMode) {
      this.broadcast({
        channels: [this.config.responseTopic],
        payload: response.content,
      });

      return;
    }

    client.publish(
      {
        payload: Buffer.from(JSON.stringify(response.content)),
        topic: this.config.responseTopic,
      } as PublishPacket,
      this.publishCallback,
    );
  }

  _respondError(client: Client, error: Error): void {
    const connection = this.connections.get(client);

    const errReq = new Request(
      {},
      {
        connection,
        error: kerror.getFrom(error, "unexpected_error", error.message),
      },
    );
    this._respond(client, removeStacktrace(errReq.response.toJSON()));
  }

  _authorizePublish(
    client: Client,
    packet: AedesPublishPacket,
    callback: (error?: Error | null) => void,
  ): void {
    const topic = packet.topic.toString();

    if (this.config.allowPubSub) {
      if (topic === this.config.responseTopic) {
        callback(new Error("Cannot publish: this topic is read-only"));
      } else if (topic.includes("#") || topic.includes("+")) {
        callback(new Error("Cannot publish: wildcards are disabled"));
      } else {
        callback(null);
      }
    } else {
      callback(
        topic === this.config.requestTopic
          ? null
          : new Error("Cannot publish on this topic: unauthorized"),
      );
    }
  }

  _authorizeSubscribe(
    client: Client,
    sub: Subscription,
    callback: (error: Error | null, subscription?: Subscription | null) => void,
  ): void {
    if (sub.topic === this.config.requestTopic) {
      callback(new Error("Cannot subscribe: this topic is write-only"));
    } else if (sub.topic.includes("#") || sub.topic.includes("+")) {
      callback(new Error("Cannot subscribe: wildcards are disabled"));
    } else {
      callback(null, sub);
    }
  }
}

export = MqttProtocol;
