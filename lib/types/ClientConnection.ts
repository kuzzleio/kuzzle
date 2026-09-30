import type { JSONObject } from "./JSONObject";

export interface ClientConnection {
  id: string;
  protocol: string;
  ips: string[];
  headers: JSONObject;
}
