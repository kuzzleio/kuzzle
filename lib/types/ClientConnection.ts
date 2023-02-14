import { JSONObject } from "../..";

export interface ClientConnection {
  id: string;
  protocol: string;
  ips: string[];
  headers: JSONObject;
}
