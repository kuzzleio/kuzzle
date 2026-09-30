import http from "node:http";

import { Then, When } from "@cucumber/cucumber";
import should from "should";
import WebSocket from "ws";

import type KuzzleWorld from "../support/world";

/** One reachable node of the test cluster. */
type NodeAddress = { host: string; port: number };

/**
 * The property under test is about what crosses the wire, so these steps talk
 * to one node directly instead of going through the world's SDK: that one
 * connects to nginx, which balances over the three development nodes, and a
 * stack trace is only stripped outside development mode.
 *
 * Which node, and how it is reachable, depends on where the suite runs: from
 * the CI runner the cluster is published on localhost ports, and from inside
 * the compose network (`.ci/scripts/docker-test.sh`) it is reachable by
 * service name. Hence the environment variables, with the published ports as
 * defaults — the same reason `KUZZLE_HOST` exists.
 */
const nodes: Record<string, NodeAddress> = {
  development: {
    host: process.env.KUZZLE_DEV_HOST || "localhost",
    port: Number.parseInt(process.env.KUZZLE_DEV_PORT || "17510", 10),
  },
  production: {
    host: process.env.KUZZLE_PROD_HOST || "localhost",
    port: Number.parseInt(process.env.KUZZLE_PROD_PORT || "17513", 10),
  },
};

function nodeAddress(kind: string) {
  const address: NodeAddress | undefined = nodes[kind];

  if (!address) {
    throw new Error(`Unknown node "${kind}" (expected development|production)`);
  }

  return address;
}

function get(
  hostname: string,
  port: number,
  path: string,
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { hostname, method: "GET", path, port },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            body: Buffer.concat(chunks).toString(),
            // `statusCode` is set on any response that reached `end`; the
            // optional type covers a socket destroyed before the head, which
            // takes the `error` path instead.
            statusCode: response.statusCode ?? 0,
          }),
        );
      },
    );

    request.on("error", reject);
    request.end();
  });
}

/**
 * One request over a raw socket, resolved with the JSON frame as it arrived.
 *
 * The SDK is deliberately not used here: it rebuilds the error client-side, so
 * `error.stack` on an SDK error is the *caller's* stack and says nothing about
 * what the server sent. This assertion is about what crosses the wire.
 */
function queryOverWebSocket(
  hostname: string,
  port: number,
  request: Record<string, string>,
): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://${hostname}:${port}`);
    const requestId = `stacktrace-${Date.now()}`;

    socket.on("error", reject);

    socket.on("open", () =>
      socket.send(JSON.stringify({ ...request, requestId })),
    );

    socket.on("message", (data) => {
      const payload = JSON.parse(data.toString());

      if (payload.requestId !== requestId) {
        return;
      }

      socket.close();
      resolve(payload);
    });
  });
}

/** The error payload of the last HTTP response, which must exist. */
function httpError(world: KuzzleWorld): Record<string, unknown> {
  const body = JSON.parse(world.props.httpResponse.body || "{}");

  // A response with no error at all would satisfy "carries no stack trace"
  // without the sanitising ever having run — the vacuous pass this feature is
  // written to avoid.
  should(body.error).not.be.undefined();

  return body.error;
}

When(
  "I send a HTTP {string} request to {string} on the {word} node",
  async function (this: KuzzleWorld, method, path, kind) {
    const { host, port } = nodeAddress(kind);

    should(method).be.eql("GET");

    this.props.httpResponse = await get(host, port, path);
  },
);

// `The HTTP response status should be {int}` is network-step.ts's, and reads
// the same `props.httpResponse` shape this file produces.

Then("The HTTP error id should be {string}", function (this: KuzzleWorld, id) {
  should(httpError(this).id).be.eql(id);
});

Then("The HTTP error carries no stack trace", function (this: KuzzleWorld) {
  should(httpError(this).stack).be.undefined();
});

Then("The HTTP error carries a stack trace", function (this: KuzzleWorld) {
  should(httpError(this).stack).be.a.String().and.not.be.empty();
});

When(
  "I query {string}:{string} over WebSocket on the {word} node",
  async function (this: KuzzleWorld, controller, action, kind) {
    const { host, port } = nodeAddress(kind);

    this.props.websocketResponse = await queryOverWebSocket(host, port, {
      action,
      controller,
    });
  },
);

/** The error payload of the last WebSocket response, which must exist. */
function websocketError(world: KuzzleWorld): Record<string, unknown> {
  const response = world.props.websocketResponse;

  should(response).not.be.undefined();
  should(response.error).not.be.undefined();

  return response.error;
}

Then(
  "The WebSocket error carries no stack trace",
  function (this: KuzzleWorld) {
    should(websocketError(this).stack).be.undefined();
  },
);

Then("The WebSocket error carries a stack trace", function (this: KuzzleWorld) {
  should(websocketError(this).stack).be.a.String().and.not.be.empty();
});
