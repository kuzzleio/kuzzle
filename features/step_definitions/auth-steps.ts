import should from "should";
import _ from "lodash";
import { createHash } from "node:crypto";

import requestPromise from "request-promise";
import { Given, When } from "@cucumber/cucumber";

import { isApiError } from "../support/errors";
import type KuzzleWorld from "../support/world";

Given(
  "I'm logged in Kuzzle as user {string} with password {string}",
  async function (this: KuzzleWorld, username, password) {
    this.props.result = await this.sdk.auth.login("local", {
      password,
      username,
    });
  },
);

Given("I'm logged as the anonymous user", function (this: KuzzleWorld) {
  this.sdk.jwt = null;
});

Given(
  /I can( not)? login with the previously created API key/,
  async function (this: KuzzleWorld, not) {
    const previousToken = this.sdk.jwt;
    const token = _.get(this.props, "result._source.token") || this.props.token;

    should(token).not.be.undefined();

    this.sdk.jwt = token;

    const { valid } = await this.sdk.auth.checkToken();

    this.sdk.jwt = previousToken;

    if (not) {
      should(valid).be.false("Provided token is valid");
    } else {
      should(valid).be.true("Provided token is invalid");
    }
  },
);

Given("I save the created API key", function (this: KuzzleWorld) {
  this.props.token = this.props.result._source.token;
});

Given(
  "I can use the single use token from the result to authenticate once",
  async function (this: KuzzleWorld) {
    const token = this.props.result.token;

    should(token).not.be.undefined();

    this.sdk.jwt = token;

    const user = await this.sdk.auth.getCurrentUser();

    should(user._id).be.eql("test-admin");

    // Unique token is not valid anymore

    try {
      await this.sdk.server.now({});

      throw new Error("Token should not be valid");
    } catch (error) {
      if (!isApiError(error) || error.id !== "security.token.invalid") {
        throw error;
      }
    }
  },
);

/**
 * `DELETE /api-keys?key=...` or `?fingerprint=...`, authenticated as the
 * current user: the route itself, not the SDK's choice of one.
 */
When(
  /I delete the saved API key over HTTP by its (key|fingerprint)/,
  async function (this: KuzzleWorld, by: "key" | "fingerprint") {
    const token: string = this.props.token;

    should(token).not.be.undefined();

    const value =
      by === "key" ? token : createHash("sha256").update(token).digest("hex");

    const response = await requestPromise({
      headers: { authorization: `Bearer ${this.sdk.jwt}` },
      json: true,
      method: "DELETE",
      resolveWithFullResponse: true,
      simple: false,
      uri: `http://${this.host}:${this.port}/api-keys?${by}=${encodeURIComponent(value)}&refresh=wait_for`,
    });

    should(response.statusCode).be.eql(200, JSON.stringify(response.body));

    this.props.result = response.body.result;
  },
);
