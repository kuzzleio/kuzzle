import { JSONObject } from "kuzzle-sdk";

export interface ClientConnection {
  id: string;
  protocol: string;
  ips: string[];
  headers: JSONObject;
}
