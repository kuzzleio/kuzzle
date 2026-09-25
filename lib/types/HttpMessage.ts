import type { JSONObject } from "./JSONObject";
import type { ClientConnection } from "./ClientConnection";

export interface HttpMessage {
  connection: ClientConnection;
  content: JSONObject;
  ips: string[];
  query: string;
  path: string;
  method: string;
  headers: JSONObject;
  requestId: string;
}
