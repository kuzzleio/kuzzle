import http from "http";
import YAML from "yaml";
import should from "should";
import requestPromise from "request-promise";

import { Then, When } from "@cucumber/cucumber";

import type KuzzleWorld from "../support/world";

/** What both senders answer, and what the `Then` steps below read. */
type RawHttpResponse = {
  body: string;
  headers: Record<string, unknown>;
  statusCode?: number;
};

/**
 * A data table's values are `eval`'d by `parseObject`, so they arrive as any
 * JavaScript value. HTTP request headers are not: narrowing here fails the step
 * by name instead of sending `[object Object]` and failing on the response.
 */
function asRequestHeaders(
  parsed: Record<string, unknown>,
): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string" && typeof value !== "number") {
      throw new Error(
        `Header "${key}" must be a string or a number, got ${JSON.stringify(value)}`,
      );
    }

    headers[key] = String(value);
  }

  return headers;
}

function normalizeHeaders(
  headers: Record<string, unknown> = {},
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }

  return normalized;
}

async function sendRawRequest(
  world: KuzzleWorld,
  {
    method,
    path,
    port,
    headers = {},
  }: {
    headers?: Record<string, string>;
    method: string;
    path: string;
    port: number;
  },
): Promise<RawHttpResponse> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const req = http.request(
      {
        headers,
        hostname: world.host,
        method,
        path,
        port,
      },
      (res) => {
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            body: Buffer.concat(chunks).toString(),
            headers: normalizeHeaders(res.headers),
            statusCode: res.statusCode,
          });
        });
      },
    );

    req.on("error", (error) => reject(error));
    req.end();
  });
}

async function sendHttpRequest(
  world: KuzzleWorld,
  { method, url, headers = {}, body }: any,
): Promise<RawHttpResponse> {
  const requestHeaders = { ...headers };

  if (
    typeof body === "string" &&
    requestHeaders["Content-Length"] === undefined &&
    requestHeaders["content-length"] === undefined
  ) {
    requestHeaders["Content-Length"] = Buffer.byteLength(body);
  }

  const response = await requestPromise({
    body,
    headers: requestHeaders,
    method,
    resolveWithFullResponse: true,
    simple: false,
    uri: url,
  });

  return {
    body: response.body,
    headers: normalizeHeaders(response.headers),
    statusCode: response.statusCode,
  };
}

When(
  "I send a raw HTTP {string} request to {string} on port {int}",
  async function (this: KuzzleWorld, method, path, port) {
    this.props.httpResponse = await sendRawRequest(this, {
      method,
      path,
      port,
    });
  },
);

When(
  "I send a raw HTTP {string} request to {string} on port {int} with headers:",
  async function (this: KuzzleWorld, method, path, port, dataTable) {
    const headers = asRequestHeaders(this.parseObject(dataTable));

    this.props.httpResponse = await sendRawRequest(this, {
      headers,
      method,
      path,
      port,
    });
  },
);

When(
  "I send a HTTP {string} request to {string}",
  async function (this: KuzzleWorld, method, url) {
    this.props.httpResponse = await sendHttpRequest(this, { method, url });
  },
);

When(
  "I send a HTTP {string} request to {string} with headers:",
  async function (this: KuzzleWorld, method, url, dataTable) {
    const headers = this.parseObject(dataTable);
    const postData = YAML.stringify({ name: "Martial" });
    this.props.httpResponse = await sendHttpRequest(this, {
      body: postData,
      headers,
      method,
      url,
    });
  },
);

Then("The raw HTTP response headers should match:", function (dataTable) {
  const expected = this.parseObject(dataTable);
  const headers = this.props.httpResponse.headers;

  should(headers).not.be.undefined();

  for (const [key, value] of Object.entries(expected)) {
    should(headers[key]).be.eql(value);
  }
});

Then("The HTTP response JSON should match:", function (dataTable) {
  const expected = this.parseObject(dataTable);
  const body = this.props.httpResponse.body || "{}";
  const json = JSON.parse(body);

  should(json).match(expected);
});

Then("The HTTP response status should be {int}", function (status) {
  should(this.props.httpResponse.statusCode).be.eql(status);
});
