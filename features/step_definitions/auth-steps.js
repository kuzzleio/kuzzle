"use strict";

const should = require("should");
const _ = require("lodash");
const { Given } = require("cucumber");

Given(
  "I'm logged in Kuzzle as user {string} with password {string}",
  async function (username, password) {
    this.props.result = await this.sdk.auth.login("local", {
      username,
      password,
    });
  }
);

Given("I'm logged as the anonymous user", function () {
  this.sdk.jwt = null;
});

Given(
  /I can( not)? login with the previously created API key/,
  async function (not) {
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
  }
);

Given("I save the created API key", function () {
  this.props.token = this.props.result._source.token;
});

Given(
  "I can use the unique token from the result to authenticate once",
  async function () {
    const token = this.props.result.token;

    should(token).not.be.undefined();

    this.sdk.jwt = token;

    const user = await this.sdk.auth.getCurrentUser();

    should(user._id).be.eql("test-admin");

    // Unique token is not valid anymore

    try {
      await this.sdk.server.now();

      throw new Error("Token should not be valid");
    }
    catch (error) {
      if (error.id !== 'security.token.invalid') {
        throw error;
      }
    }
  });