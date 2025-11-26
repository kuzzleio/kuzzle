import http from "http";
import should from "should";
import requestPromise from "request-promise";

import { Then, When } from "@cucumber/cucumber";

function normalizeHeaders(headers = {}) {
  const normalized = {};

  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }

  return normalized;
}

async function sendRawRequest(world, { method, path, port, headers = {} }) {
  return new Promise((resolve, reject) => {
    const chunks = [];

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
  world,
  { method, url, headers = {}, body }: any,
) {
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
  async function (method, path, port) {
    this.props.httpResponse = await sendRawRequest(this, {
      method,
      path,
      port,
    });
  },
);

When(
  "I send a raw HTTP {string} request to {string} on port {int} with headers:",
  async function (method, path, port, dataTable) {
    const headers = this.parseObject(dataTable);

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
  async function (method, url) {
    this.props.httpResponse = await sendHttpRequest(this, { method, url });
  },
);

When(
  "I send a HTTP {string} request to {string} with headers and body:",
  async function (method, url, dataTable, body) {
    const headers = this.parseObject(dataTable);

    this.props.httpResponse = await sendHttpRequest(this, {
      body,
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
