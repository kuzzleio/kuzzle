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

import { JSONObject } from "kuzzle-sdk";

import createDebug from "../../../util/debug";
import ClientConnection from "../clientConnection";
import { NetworkEntryPoint } from "../networkEntryPoint";
import Protocol from "./protocol";

const debug = createDebug("kuzzle:network:protocols:internal");

interface InternalMessage {
  channels: string[];
  payload: JSONObject;
}

/**
 * Internal protocol to use SDK realtime subscription from plugins.
 *
 * This protocol only use one connection. This connection is always open.
 *
 * Messages to the embedded SDK are dispatched with the following event:
 *  - 'core:network:internal:message'
 */
class InternalProtocol extends Protocol {
  public connection: ClientConnection;

  /** List of channel IDs */
  public channels: Set<string>;

  constructor() {
    super("internal");

    this.connection = new ClientConnection(this.name, ["127.0.0.1"]);

    this.channels = new Set();
  }

  async init(entryPoint: NetworkEntryPoint): Promise<boolean> {
    await super.init(null, entryPoint);

    debug("initializing InternalProtocol");

    this.entryPoint.newConnection(this.connection);

    /**
     * Returns the internal connection ID used by the protocol.
     */
    global.kuzzle.onAsk(
      "core:network:internal:connectionId:get",
      () => this.connection.id,
    );

    return true;
  }

  joinChannel(channel: string, connectionId: string) {
    debug("joinChannel: %s", channel, connectionId);

    this.channels.add(channel);

    return { channel, connectionId };
  }

  leaveChannel(channel: string, connectionId: string) {
    debug("leaveChannel: %s", channel, connectionId);

    this.channels.delete(channel);

    return { channel, connectionId };
  }

  disconnect(connectionId: string): void {
    debug("disconnect: %s", connectionId);

    // Never happens, the InternalProtocol always keep his only connection open
  }

  broadcast(data: InternalMessage): void {
    debug("broadcast: %a", data);

    this._send(data);
  }

  notify(data: InternalMessage): void {
    debug("notify: %a", data);

    this._send(data);
  }

  _send(data: InternalMessage): void {
    for (const channel of data.channels) {
      const message = { ...data.payload, room: channel };

      global.kuzzle.emit("core:network:internal:message", message);
    }
  }
}

export = InternalProtocol;
