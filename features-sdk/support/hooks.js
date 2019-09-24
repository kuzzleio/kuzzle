'use strict';

const
  _ = require('lodash'),
  { After, Before, BeforeAll } = require('cucumber'),
  { Kuzzle, WebSocket, Http } = require('kuzzle-sdk'),
  testMappings = require('../fixtures/mappings'),
  testFixtures = require('../fixtures/fixtures'),
  testSecurities = require('../fixtures/securities'),
  World = require('./world');

function getProtocol (world) {
  let protocol;

  switch (world.protocol) {
    case 'http':
      protocol = new Http(world.host, { port: world.port });
      break;
    case 'websocket':
      protocol = new WebSocket(world.host, { port: world.port });
      break;
    default:
      throw new Error(`Unknown protocol "${world.protocol}".`);
  }

  return protocol;
}

BeforeAll(({ timeout: 10 * 1000 }), async function () {
  const world = new World({});

  world.sdk = new Kuzzle(getProtocol(world));

  await world.sdk.connect();

  console.log('Loading default securities..');

  await world.sdk.query({
    controller: 'admin',
    action: 'loadSecurities',
    body: testSecurities,
    refresh: 'wait_for'
  });

  world.sdk.disconnect();
});

Before(({ timeout: 10 * 1000 }), async function () {
  this.sdk = new Kuzzle(getProtocol(this));

  await this.sdk.connect();
  await this.sdk.auth.login(
    'local',
    { username: 'test-admin', password: 'password' });

  await this.sdk.query({
    controller: 'admin',
    action: 'resetDatabase',
    refresh: 'wait_for'
  });

  await this.sdk.query({
    controller: 'admin',
    action: 'loadMappings',
    body: testMappings,
    refresh: 'wait_for'
  });

  await this.sdk.query({
    controller: 'admin',
    action: 'loadFixtures',
    body: testFixtures,
    refresh: 'wait_for'
  });
});

After(async function () {
  // Clean values stored by the scenario
  this.props = {};

  if (this.sdk && typeof this.sdk.disconnect === 'function') {
    this.sdk.disconnect();
  }
});

Before({ tags: '@security', timeout: 10 * 1000 }, async function () {
  await this.sdk.query({
    controller: 'admin',
    action: 'resetSecurity',
    refresh: 'wait_for'
  });

  this.sdk.jwt = null;

  await this.sdk.query({
    controller: 'admin',
    action: 'loadSecurities',
    body: testSecurities,
    refresh: 'wait_for'
  });

  await this.sdk.auth.login(
    'local',
    { username: 'test-admin', password: 'password' });
});
