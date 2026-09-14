import type { JSONObject } from "kuzzle-sdk";
import type { PipeEventHandler } from "../../../index";
import type { ClientConnection } from "../ClientConnection";
import type { HttpMessage } from "../HttpMessage";

export type EventHTTPBeforeParsingPayload = {
  name: `protocol:http:beforeParsingPayload`;

  args: [{ message: HttpMessage; payload: Buffer }];
} & PipeEventHandler;

export type EventHTTPAfterParsingPayload = {
  name: `protocol:http:afterParsingPayload`;

  args: [{ message: HttpMessage; payload: JSONObject }];
} & PipeEventHandler;

export type EventWebsocketBeforeParsingPayload = {
  name: `protocol:websocket:beforeParsingPayload`;

  args: [{ connection: ClientConnection; payload: Buffer }];
} & PipeEventHandler;

export type EventWebsocketAfterParsingPayload = {
  name: `protocol:websocket:afterParsingPayload`;

  args: [{ connection: ClientConnection; payload: JSONObject }];
} & PipeEventHandler;
