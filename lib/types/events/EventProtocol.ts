import { JSONObject, PipeEventHandler } from "../../../";
import { HttpMessage } from "../HttpMessage";

export type EventHTTPBeforeParsingPayload = {
  name: `protocol:http:beforeParsingPayload`;

  args: [{ message: HttpMessage, payload: Buffer }];
} & PipeEventHandler;

export type EventHTTPAfterParsingPayload = {
  name: `protocol:http:afterParsingPayload`;

  args: [{ message: HttpMessage, payload: JSONObject }];
} & PipeEventHandler;

export type EventWebsocketBeforeParsingPayload = {
  name: `protocol:websocket:beforeParsingPayload`;

  args: [{ payload: Buffer }];
} & PipeEventHandler;

export type EventWebsocketAfterParsingPayload = {
  name: `protocol:websocket:afterParsingPayload`;

  args: [{ payload: JSONObject }];
} & PipeEventHandler;