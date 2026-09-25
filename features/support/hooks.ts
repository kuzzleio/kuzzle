import { After, Before, BeforeAll } from "@cucumber/cucumber";

import type { Kuzzle } from "kuzzle-sdk";

import testMappings from "../fixtures/mappings";
import testPermissions from "../fixtures/permissions";
import testFixtures from "../fixtures/fixtures";
import KuzzleWorld from "./world";

async function resetSecurityDefault(sdk: Kuzzle) {
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
    const world = new KuzzleWorld({} as any);

    await world.sdk.connect();

    await world.sdk.query({
      action: "loadSecurities",
      body: testPermissions,
      controller: "admin",
      onExistingUsers: "overwrite",
      refresh: "wait_for",
    });

    world.sdk.disconnect();
  } catch (error) {
    console.error(error);
    throw error;
  }
});

Before({ timeout: 10 * 1000 }, async function (this: KuzzleWorld) {
  await this.sdk.connect();

  await this.sdk.auth.login("local", {
    password: "password",
    username: "test-admin",
  });
});

Before({ tags: "not @preserveDatabase" }, async function (this: KuzzleWorld) {
  await this.sdk.query({
    action: "resetDatabase",
    controller: "admin",
    refresh: "wait_for",
  });
});

After(async function (this: KuzzleWorld) {
  // No `props` reset: cucumber builds a new World, and so a new `props`, for
  // every scenario. The assignment that stood here wrote to a `readonly` field.

  if (this.sdk && typeof this.sdk.disconnect === "function") {
    this.sdk.disconnect();
  }
});

Before({ tags: "@production" }, async function (this: KuzzleWorld) {
  if (process.env.NODE_ENV !== "production") {
    return "skipped";
  }
});

Before({ tags: "@development" }, async function (this: KuzzleWorld) {
  if (process.env.NODE_ENV !== "development") {
    return "skipped";
  }
});

Before({ tags: "@http" }, async function (this: KuzzleWorld) {
  if (process.env.KUZZLE_PROTOCOL !== "http") {
    return "skipped";
  }
});

Before({ tags: "@not-http" }, async function (this: KuzzleWorld) {
  if (process.env.KUZZLE_PROTOCOL === "http") {
    return "skipped";
  }
});

// firstAdmin hooks ============================================================

Before({ tags: "@firstAdmin" }, async function (this: KuzzleWorld) {
  await this.sdk.query({
    action: "resetSecurity",
    controller: "admin",
    refresh: "wait_for",
  });

  this.sdk.jwt = null;
});

After(
  { tags: "@firstAdmin", timeout: 60 * 1000 },
  async function (this: KuzzleWorld) {
    await resetSecurityDefault(this.sdk);
  },
);

// security hooks ==============================================================

After(
  { tags: "@security", timeout: 60 * 1000 },
  async function (this: KuzzleWorld) {
    await resetSecurityDefault(this.sdk);
  },
);

// mappings hooks ==============================================================

Before({ tags: "@mappings" }, async function (this: KuzzleWorld) {
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

After({ tags: "@events" }, async function (this: KuzzleWorld) {
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

After({ tags: "@login" }, async function (this: KuzzleWorld) {
  await this.sdk.auth.login("local", {
    password: "password",
    username: "test-admin",
  });
});

/** A room handle as the realtime steps store it. */
function isUnsubscribable(
  value: unknown,
): value is { unsubscribe: () => Promise<void> } {
  return (
    typeof value === "object" &&
    value !== null &&
    "unsubscribe" in value &&
    typeof value.unsubscribe === "function"
  );
}

// realtime hooks ==============================================================

After({ tags: "@realtime" }, function (this: KuzzleWorld) {
  if (!this.props.subscriptions) {
    return;
  }
  // `props` is the world's untyped scratch space, so its values arrive as
  // `unknown`. Anything in `props.subscriptions` that cannot be unsubscribed
  // from is a bookkeeping mistake, and this hook is the last place it can be
  // seen — so it fails the scenario rather than being skipped silently.
  const promises = Object.values(this.props.subscriptions).map(
    (subscription) => {
      if (!isUnsubscribable(subscription)) {
        throw new Error(
          `@realtime teardown: props.subscriptions holds something that cannot unsubscribe: ${JSON.stringify(subscription)}`,
        );
      }

      return subscription.unsubscribe();
    },
  );

  return Promise.all(promises);
});

After({ tags: "@websocket" }, function (this: KuzzleWorld) {
  this.props.client.terminate();
});

// cluster hooks ===============================================================

Before({ tags: "@cluster" }, async function (this: KuzzleWorld) {
  // The default `Before` logged `this.sdk` in; its token is valid on every
  // node, so each node's SDK acts as the same user.
  const jwt = this.sdk.jwt;

  this.sdk.disconnect();

  // Nodes 1-3 by published port from the CI runner; `docker-test.sh` runs the
  // suite inside the compose network and names them by service instead.
  const nodes = (
    process.env.KUZZLE_CLUSTER_NODES ||
    "localhost:17510,localhost:17511,localhost:17512"
  ).split(",");

  this.nodes = Object.fromEntries(
    nodes.map((address, i) => {
      const [host, port] = address.split(":");

      return [`node${i + 1}`, this.getSDK({ host, port })];
    }),
  );

  await Promise.all(
    Object.values(this.nodes).map(async (sdk) => {
      await sdk.connect();
      sdk.jwt = jwt;
    }),
  );
});

After({ tags: "@cluster" }, async function (this: KuzzleWorld) {
  for (const sdk of Object.values(this.nodes)) {
    sdk.disconnect();
  }
});
