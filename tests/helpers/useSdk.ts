import { Kuzzle, WebSocket } from "kuzzle-sdk";

export function useSdk(): Kuzzle {
  return new Kuzzle(new WebSocket("localhost", { port: 7512 }));
}
