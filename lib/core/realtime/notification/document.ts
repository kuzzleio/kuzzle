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

import { InternalError } from "../../../kerror/errors";
import { KuzzleRequest } from "../../../api/request";
import { RealtimeScope } from "../../../types";
import "../../../types/Global";

/**
 * Coarse event a document action belongs to. Subscribers filter on it, so the
 * mapping below is part of the realtime contract.
 */
type DocumentNotificationEvent = "write" | "delete" | "publish";

/**
 * Constructor payload. Two producers fill it: `fromRequest` below, and
 * `cluster/subscriber` when it rebuilds a notification from a decoded protobuf
 * message — hence the wide `result` and `volatile`.
 */
interface DocumentNotificationOptions {
  status: number;
  action: string;
  scope: RealtimeScope;
  result: JSONObject;
  node: string;
  requestId?: string;
  timestamp: number;
  volatile: JSONObject;
  index: string;
  collection: string;
  controller: string;
  protocol: string;
}

function getEvent(action: string): DocumentNotificationEvent {
  switch (action) {
    case "create":
    case "mCreate":
    case "createOrReplace":
    case "mCreateOrReplace":
    case "replace":
    case "mReplace":
    case "update":
    case "updateByQuery":
    case "mUpdate":
    case "write":
    case "mWrite":
    case "upsert":
      return "write";

    case "delete":
    case "deleteByQuery":
    case "mDelete":
      return "delete";

    case "publish":
      return "publish";

    default:
      throw new InternalError(`Unknown event type for action "${action}"`);
  }
}

/**
 * Document notification document
 */
class DocumentNotification {
  public type = "document";
  public status: number;
  public action: string;
  public scope: RealtimeScope;
  public result: JSONObject;
  public node: string;
  public event: DocumentNotificationEvent;
  public requestId?: string;
  public timestamp: number;
  public volatile: JSONObject;
  public index: string;
  public collection: string;
  public controller: string;
  public protocol: string;

  constructor(opts: DocumentNotificationOptions) {
    this.status = opts.status;
    this.action = opts.action;
    this.scope = opts.scope;
    this.result = opts.result;
    this.node = opts.node;

    this.event = getEvent(this.action);

    this.requestId = opts.requestId;
    this.timestamp = opts.timestamp;
    this.volatile = opts.volatile;
    this.index = opts.index;
    this.collection = opts.collection;
    this.controller = opts.controller;
    this.protocol = opts.protocol;
  }

  /**
   * Instantiates a DocumentNotification object from a KuzzleRequest
   *
   * @param request - the request object from which the notification is issued
   * @param scope - The scope of the notification (in or out)
   * @param action - Action performed on the document
   * @param result - Notification content
   */
  static fromRequest(
    request: KuzzleRequest,
    scope: RealtimeScope,
    action: string,
    result: JSONObject,
  ): DocumentNotification {
    return new DocumentNotification({
      action,
      collection: request.input.args.collection,
      controller: request.input.controller,
      index: request.input.args.index,
      node: global.kuzzle.id,
      protocol: request.context.connection.protocol,
      requestId: request.id,
      result,
      scope,
      status: 200,
      timestamp: request.timestamp,
      volatile: request.input.volatile,
    });
  }
}

export = DocumentNotification;
