'use strict';

const
  { After, Before, BeforeAll } = require('cucumber'),
  testMappings = require('../fixtures/mappings'),
  testPermissions = require('../fixtures/permissions'),
  testFixtures = require('../fixtures/fixtures'),
  World = require('./world');

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
    body: testPermissions,
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

  await world.sdk.connect();

  console.log('Loading default permissions..');

  await world.sdk.query({
    controller: 'admin',
    action: 'loadSecurities',
    body: testPermissions,
    onExistingUsers: 'overwrite',
    refresh: 'wait_for'
  });

  world.sdk.disconnect();
});

Before(({ timeout: 10 * 1000 }), async function () {
  await this.sdk.connect();

  await this.sdk.auth.login(
    'local',
    { username: 'test-admin', password: 'password' });
});

Before(({ tags: 'not @preserveDatabase' }), async function () {
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

Before({ tags: '@production' }, async function () {
  if (process.env.NODE_ENV !== 'production') {
    return 'skipped';
  }
});

Before({ tags: '@development' }, async function () {
  if (process.env.NODE_ENV !== 'development') {
    return 'skipped';
  }
});

Before({ tags: '@http' }, async function () {
  if (process.env.KUZZLE_PROTOCOL !== 'http') {
    return 'skipped';
  }
});

Before({ tags: '@not-http' }, async function () {
  if (process.env.KUZZLE_PROTOCOL === 'http') {
    return 'skipped';
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

After({ tags: '@security', timeout: 60 * 1000 }, async function () {
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

  await this.sdk.query({
    controller: 'admin',
    action: 'loadFixtures',
    body: testFixtures,
    refresh: 'wait_for'
  });
});

// events hooks ================================================================

After({ tags: '@events' }, async function () {
  await this.sdk.query({
    controller: 'functional-test-plugin/pipes',
    action: 'deactivateAll'
  });

  await this.sdk.query({
    controller: 'pipes',
    action: 'deactivateAll'
  });
});

// login hooks =================================================================

After({ tags: '@login' }, async function () {
  await this.sdk.auth.login(
    'local',
    { username: 'test-admin', password: 'password' });
});

// realtime hooks ==============================================================

After({ tags: '@realtime' }, function () {
  if (!this.props.subscriptions) {
    return;
  }
  const promises = Object.values(this.props.subscriptions)
    .map(({ unsubscribe }) => unsubscribe());

  return Promise.all(promises);
});

After({ tags: '@websocket' }, function () {
  this.props.client.terminate();
});
