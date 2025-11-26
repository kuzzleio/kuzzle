import { After, Before, BeforeAll } from "@cucumber/cucumber";

import { EmbeddedSDK } from "../../lib/core/shared/sdk/embeddedSdk";
import testMappings from "../fixtures/mappings";
import testPermissions from "../fixtures/permissions";
import testFixtures from "../fixtures/fixtures";
import World from "./world";

async function resetSecurityDefault(sdk: EmbeddedSDK) {
  await sdk.query({
    action: "resetSecurity",
    controller: "admin",
    refresh: "wait_for",
  });

  sdk.jwt = null;

  await sdk.query({
    action: "loadSecurities",
    body: testPermissions,
    controller: "admin",
    refresh: "wait_for",
  });

  await sdk.auth.login("local", {
    password: "password",
    username: "test-admin",
  });
}

// Common hooks ================================================================

BeforeAll({ timeout: 10 * 1000 }, async function () {
  try {
    const world = new World({} as any);

    console.log(
      `Start tests with ${world.protocol.toLocaleUpperCase()} protocol.`,
    );

    await world.sdk.connect();

    console.log("Loading default permissions..");

    await world.sdk.query({
      action: "loadSecurities",
      body: testPermissions,
      controller: "admin",
      onExistingUsers: "overwrite",
      refresh: "wait_for",
    });

    world.sdk.disconnect();
  } catch (error) {
    console.log(error);
    throw error;
  }
});

Before({ timeout: 10 * 1000 }, async function () {
  await this.sdk.connect();

  await this.sdk.auth.login("local", {
    password: "password",
    username: "test-admin",
  });
});

Before({ tags: "not @preserveDatabase" }, async function () {
  await this.sdk.query({
    action: "resetDatabase",
    controller: "admin",
    refresh: "wait_for",
  });
});

After(async function () {
  // Clean values stored by the scenario
  this.props = {};

  if (this.sdk && typeof this.sdk.disconnect === "function") {
    this.sdk.disconnect();
  }
});

Before({ tags: "@production" }, async function () {
  if (process.env.NODE_ENV !== "production") {
    return "skipped";
  }
});

Before({ tags: "@development" }, async function () {
  if (process.env.NODE_ENV !== "development") {
    return "skipped";
  }
});

Before({ tags: "@http" }, async function () {
  if (process.env.KUZZLE_PROTOCOL !== "http") {
    return "skipped";
  }
});

Before({ tags: "@not-http" }, async function () {
  if (process.env.KUZZLE_PROTOCOL === "http") {
    return "skipped";
  }
});

// firstAdmin hooks ============================================================

Before({ tags: "@firstAdmin" }, async function () {
  await this.sdk.query({
    action: "resetSecurity",
    controller: "admin",
    refresh: "wait_for",
  });

  this.sdk.jwt = null;
});

After({ tags: "@firstAdmin", timeout: 60 * 1000 }, async function () {
  await resetSecurityDefault(this.sdk);
});

// security hooks ==============================================================

After({ tags: "@security", timeout: 60 * 1000 }, async function () {
  await resetSecurityDefault(this.sdk);
});

// mappings hooks ==============================================================

Before({ tags: "@mappings" }, async function () {
  await this.sdk.query({
    action: "loadMappings",
    body: testMappings,
    controller: "admin",
    refresh: "wait_for",
  });

  await this.sdk.query({
    action: "loadFixtures",
    body: testFixtures,
    controller: "admin",
    refresh: "wait_for",
  });
});

// events hooks ================================================================

After({ tags: "@events" }, async function () {
  await this.sdk.query({
    action: "deactivateAll",
    controller: "functional-test-plugin/pipes",
  });

  await this.sdk.query({
    action: "deactivateAll",
    controller: "pipes",
  });
});

// login hooks =================================================================

After({ tags: "@login" }, async function () {
  await this.sdk.auth.login("local", {
    password: "password",
    username: "test-admin",
  });
});

// realtime hooks ==============================================================

After({ tags: "@realtime" }, function () {
  if (!this.props.subscriptions) {
    return;
  }
  const promises = Object.values(this.props.subscriptions).map(
    ({ unsubscribe }) => unsubscribe(),
  );

  return Promise.all(promises);
});

After({ tags: "@websocket" }, function () {
  this.props.client.terminate();
});

// cluster hooks ===============================================================

Before({ tags: "@cluster" }, async function () {
  this.sdk.disconnect();

  this.node1 = this.getSDK({ port: 17510 });
  this.node2 = this.getSDK({ port: 17511 });
  this.node3 = this.getSDK({ port: 17512 });

  await Promise.all([
    this.node1.connect(),
    this.node2.connect(),
    this.node3.connect(),
  ]);
});

After({ tags: "@cluster" }, async function () {
  this.node1.disconnect();
  this.node2.disconnect();
  this.node3.disconnect();
});
