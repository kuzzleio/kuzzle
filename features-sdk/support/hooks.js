'use strict';

const
  { After, Before, BeforeAll } = require('cucumber'),
  { Kuzzle, WebSocket, Http } = require('kuzzle-sdk'),
  testMappings = require('../fixtures/mappings'),
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

async function resetSecurityDefault (sdk) {
  await sdk.query({
    controller: 'admin',
    action: 'resetSecurity',
    refresh: 'wait_for'
  });

  sdk.jwt = null;

  await sdk.query({
    controller: 'admin',
    action: 'loadSecurities',
    body: testSecurities,
    refresh: 'wait_for'
  });

  await sdk.auth.login(
    'local',
    { username: 'test-admin', password: 'password' });
}

// Common hooks ================================================================

BeforeAll(({ timeout: 10 * 1000 }), async function () {
  const world = new World({});

  console.log(`Start tests with ${world.protocol.toLocaleUpperCase()} protocol.`);

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
});

After(async function () {
  // Clean values stored by the scenario
  this.props = {};

  if (this.sdk && typeof this.sdk.disconnect === 'function') {
    this.sdk.disconnect();
  }
});

// firstAdmin hooks ============================================================

Before({ tags: '@firstAdmin' }, async function () {
  await this.sdk.query({
    controller: 'admin',
    action: 'resetSecurity',
    refresh: 'wait_for'
  });

  this.sdk.jwt = null;
});

After({ tags: '@firstAdmin', timeout: 60 * 1000 }, async function () {
  await resetSecurityDefault(this.sdk);
});

// security hooks ==============================================================

Before({ tags: '@security', timeout: 60 * 1000 }, async function () {
  await resetSecurityDefault(this.sdk);
});

// mappings hooks ==============================================================

Before({ tags: '@mappings' }, async function () {
  await this.sdk.query({
    controller: 'admin',
    action: 'loadMappings',
    body: testMappings,
    refresh: 'wait_for'
  });
});
