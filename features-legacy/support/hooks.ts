import { After, Before, BeforeAll } from "@cucumber/cucumber";

import fixtures from "../fixtures/functionalTestsFixtures.json";
import Http from "./api/http";
import World from "./world";

type HookWorld = {
  api: any;
  currentUser?: any;
  currentToken?: any;
  users?: any;
  idPrefix: string;
  fakeIndex: string;
  fakeAltIndex: string;
  fakeNewIndex: string;
  fakeCollection: string;
  fakeAltCollection: string;
};

async function bootstrapDatabase() {
  const world = new World({ parameters: parseWorldParameters() });
  const http = new Http(world);

  for (const index of Object.keys(fixtures)) {
    await http.deleteIndex(index).catch(() => true);
  }

  const mappings = {
    dynamic: "true",
    properties: { foo: { type: "keyword" } },
  };

  await http.createIndex(world.fakeIndex);
  await http.createCollection(world.fakeIndex, world.fakeCollection, mappings);
  await http.createCollection(
    world.fakeIndex,
    world.fakeAltCollection,
    mappings,
  );

  await http.createIndex(world.fakeAltIndex);
  await http.createCollection(
    world.fakeAltIndex,
    world.fakeCollection,
    mappings,
  );
  await http.createCollection(
    world.fakeAltIndex,
    world.fakeAltCollection,
    mappings,
  );
}

async function cleanDatabase() {
  const world = new World({ parameters: parseWorldParameters() });
  const http = new Http(world);

  const indexes = [
    world.fakeIndex,
    world.fakeAltIndex,
    world.fakeNewIndex,
    "tolkien",
  ];

  await Promise.all(
    indexes.map((index) => http.deleteIndex(index).catch(() => true)),
  );
}

BeforeAll(async function () {
  await cleanDatabase();
  await bootstrapDatabase();
});

Before({ timeout: 10 * 2000 }, async function (this: HookWorld) {
  const world = new World({ parameters: parseWorldParameters() });

  try {
    await this.api.truncateCollection(world.fakeIndex, world.fakeCollection);
  } catch {
    // Nothing to do
  }

  try {
    await this.api.truncateCollection(
      world.fakeAltIndex,
      world.fakeAltCollection,
    );
  } catch {
    // Nothing to do
  }

  await this.api.resetSecurity();
});

Before({ tags: "@resetDatabase", timeout: 10 * 2000 }, async function () {
  await cleanDatabase();
  await bootstrapDatabase();
});

After(async function (this: HookWorld) {
  return this.api.disconnect();
});

After({ tags: "@realtime" }, function (this: HookWorld) {
  return this.api.unsubscribeAll().catch(() => true);
});

Before({ tags: "@security" }, function (this: HookWorld) {
  return cleanSecurity.call(this);
});

Before({ tags: "@firstAdmin" }, function (this: HookWorld) {
  return cleanSecurity.call(this);
});

After({ tags: "@firstAdmin" }, async function (this: HookWorld) {
  await grantDefaultRoles.call(this);
  return cleanSecurity.call(this);
});

Before({ tags: "@redis" }, function (this: HookWorld) {
  return cleanRedis.call(this);
});

After({ tags: "@redis" }, function (this: HookWorld) {
  return cleanRedis.call(this);
});

Before({ tags: "@validation" }, function (this: HookWorld) {
  return cleanValidations.call(this);
});

After({ tags: "@validation" }, function (this: HookWorld) {
  return cleanValidations.call(this);
});

After({ tags: "@http" }, function (this: HookWorld) {
  this.api.encode("identity");
  this.api.decode("identity");
});

function cleanSecurity(this: HookWorld) {
  if (this.currentUser) {
    delete this.currentUser;
  }

  return this.api.resetSecurity();
}

async function grantDefaultRoles(this: HookWorld) {
  const body = await this.api.login(
    "local",
    this.users.useradmin.credentials.local,
  );

  if (body.error) {
    throw new Error(body.error.message);
  }

  if (!body.result) {
    throw new Error("No result provided");
  }

  if (!body.result.jwt) {
    throw new Error("No token received");
  }

  if (this.currentUser === null || this.currentUser === undefined) {
    this.currentUser = {};
  }

  this.currentToken = { jwt: body.result.jwt };
  this.currentUser.token = body.result.jwt;

  await this.api.createOrReplaceRole("anonymous", {
    controllers: { "*": { actions: { "*": true } } },
  });
  await this.api.createOrReplaceRole("default", {
    controllers: { "*": { actions: { "*": true } } },
  });
  await this.api.createOrReplaceRole("admin", {
    controllers: { "*": { actions: { "*": true } } },
  });
}

function cleanRedis(this: HookWorld) {
  return this.api
    .callMemoryStorage("keys", { args: { pattern: `${this.idPrefix}*` } })
    .then((response) => {
      if (Array.isArray(response.result) && response.result.length) {
        return this.api.callMemoryStorage("del", {
          body: { keys: response.result },
        });
      }

      return null;
    });
}

async function cleanValidations(this: HookWorld) {
  const body = await this.api.searchSpecifications({
    query: {
      match_all: { boost: 1 },
    },
  });

  const deletions = (body.result?.hits ?? [])
    .filter(
      (r: any) => typeof r._id === "string" && /^kuzzle-test-/.test(r._id),
    )
    .map((r: any) =>
      this.api.deleteSpecifications(r._id.split("#")[0], r._id.split("#")[1]),
    );

  await Promise.all(deletions);
}

function parseWorldParameters(): any {
  const worldParamIndex = process.argv.indexOf("--world-parameters");
  const worldParam =
    worldParamIndex > -1 ? JSON.parse(process.argv[worldParamIndex + 1]) : {};

  return {
    host: "localhost",
    port: 7512,
    protocol: "websocket",
    silent: true,
    ...worldParam,
  };
}
