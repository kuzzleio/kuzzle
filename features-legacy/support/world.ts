import {
  setDefaultTimeout,
  setWorldConstructor,
  World,
} from "@cucumber/cucumber";

import { loadConfig } from "../../lib/config";
import HttpApi from "./api/http";
import MqttApi from "./api/mqtt";
import WebSocketApi from "./api/websocket";

type LegacyWorldParameters = {
  protocol?: string;
  host?: string;
  port?: number | string;
  silent?: boolean;
  [key: string]: any;
};

/**
 * An API payload as the step definitions read it. The suite indexes into it by
 * a field name a feature file supplied — `this.result[field]` — so the shape
 * cannot be pinned without inventing one; `support/api/apiBase.ts` says the
 * same thing about what it returns.
 */
type ApiPayload = Record<string, any>;

let initialized = false;

export default class KWorld extends World {
  config: LegacyWorldParameters;
  api: HttpApi | MqttApi | WebSocketApi;
  kuzzleConfig: ReturnType<typeof loadConfig>;
  idPrefix: string;
  currentUser: any;
  fakeIndex: string;
  fakeAltIndex: string;
  fakeNewIndex: string;
  fakeCollection: string;
  fakeAltCollection: string;
  documentGrace: any;
  documentAda: any;
  bulk: any[];
  mapping: any;
  securitymapping: any;
  volatile: any;
  roles: any;
  policies: any;
  profiles: any;
  users: any;
  credentials: any;
  memoryStorageResult: any;

  // Scenario scratch state: what one step writes for the next one to assert
  // on. The class used to declare only the fixtures it constructs, so every
  // one of these was an undeclared property that `strict` could not see —
  // which is how `this.index` and `this.collection`, read by bulk.ts and
  // written by nothing, stayed invisible.
  result: ApiPayload;
  apiResult: ApiPayload;
  updatedResult: ApiPayload;
  body: ApiPayload;
  currentToken: { jwt: string; tokenValidity?: ApiPayload } | null;
  scrollId: string | null;
  statusCode?: number;

  constructor(config: any) {
    super(config);

    const parameters: LegacyWorldParameters = config?.parameters ?? {};

    this.config = Object.assign(
      {
        host: "localhost",
        port: 7512,
        protocol: "websocket",
      },
      parameters,
    );

    switch (this.config.protocol) {
      case "http":
        this.api = new HttpApi(this);
        break;
      case "mqtt":
        this.api = new MqttApi(this);
        break;
      default:
        this.api = new WebSocketApi(this);
        this.config.protocol = "websocket";
    }

    if (!initialized && !this.config.silent) {
      console.log(
        `[${this.config.protocol}] ${this.config.host}:${this.config.port}`,
      );
      initialized = true;
    }

    this.kuzzleConfig = loadConfig();
    this.idPrefix = "kuzzle-functional-tests-";

    this.currentUser = null;

    // Fake values for test
    this.fakeIndex = "kuzzle-test-index";
    this.fakeAltIndex = "kuzzle-test-index-alt";
    this.fakeNewIndex = "kuzzle-test-index-new";
    this.fakeCollection = "kuzzle-collection-test";
    this.fakeAltCollection = "kuzzle-collection-test-alt";

    this.documentGrace = {
      firstName: "Grace",
      info: {
        age: 85,
        city: "NYC",
        hobby: "computer",
      },
      lastName: "Hopper",
      location: {
        lat: 32.692742,
        lon: -97.114127,
      },
    };
    this.documentAda = {
      firstName: "Ada",
      info: {
        age: 36,
        city: "London",
        hobby: "computer",
      },
      lastName: "Lovelace",
      location: {
        lat: 51.519291,
        lon: -0.149817,
      },
    };
    this.bulk = [
      { index: { _id: 1 } },
      { title: "foo" },
      { index: { _id: 2 } },
      { title: "bar" },
      { update: { _id: 1 } },
      { doc: { title: "foobar" } },
      { delete: { _id: 2 } },
    ];

    this.mapping = {
      properties: {
        firstName: {
          copy_to: "newFirstName",
          type: "text",
        },
        newFirstName: {
          store: true,
          type: "keyword",
        },
      },
    };

    this.securitymapping = {
      properties: {
        bar: {
          store: true,
          type: "keyword",
        },
        foo: {
          copy_to: "bar",
          type: "text",
        },
      },
    };

    this.volatile = {
      iwant: "to break free",
      we: ["will", "rock", "you"],
    };

    this.roles = {
      admin: {
        controllers: {
          "*": {
            actions: {
              "*": true,
            },
          },
        },
      },
      anonymous: {
        controllers: {
          auth: {
            actions: {
              checkToken: true,
              getCurrentUser: true,
              getMyRights: true,
              login: true,
            },
          },
          server: {
            actions: {
              info: true,
            },
          },
        },
      },
      bar: {
        controllers: {
          bar: {
            actions: {
              "*": true,
            },
          },
        },
      },
      default: {
        controllers: {
          auth: {
            actions: {
              checkToken: true,
              getCurrentUser: true,
              getMyRights: true,
              logout: true,
              updateSelf: true,
            },
          },
          server: {
            actions: {
              info: true,
            },
          },
        },
      },
      foo: {
        controllers: {
          foo: {
            actions: {
              "*": true,
            },
          },
        },
      },
      foobar: {
        controllers: {
          bar: {
            actions: {
              "*": true,
            },
          },
          foo: {
            actions: {
              "*": true,
            },
          },
        },
      },
      role1: {
        controllers: {
          "*": {
            actions: {
              "*": true,
            },
          },
        },
      },
      role2: {
        controllers: {
          auth: { actions: { logout: true } },
          document: {
            actions: {
              "*": true,
            },
          },
        },
      },
      role3: {
        controllers: {
          auth: { actions: { logout: true } },
          document: {
            actions: {
              search: true,
            },
          },
        },
      },
    };

    this.policies = {
      profile1: [
        {
          action: "*",
          collection: "*",
          controller: "*",
          index: "*",
          value: "allowed",
        },
      ],
      profile2: [
        {
          action: "*",
          collection: "*",
          controller: "*",
          index: this.fakeIndex,
          value: "allowed",
        },
        {
          action: "*",
          collection: "*",
          controller: "document",
          index: "*",
          value: "allowed",
        },
        {
          action: "logout",
          collection: "*",
          controller: "auth",
          index: "*",
          value: "allowed",
        },
      ],
    };

    this.profiles = {
      admin: {
        policies: [{ roleId: "admin" }],
      },
      adminfoo: {
        policies: [{ roleId: "admin" }, { roleId: this.idPrefix + "foo" }],
      },
      anonymous: {
        policies: [{ roleId: "anonymous" }],
      },
      anonymousfoo: {
        policies: [{ roleId: "anonymous" }, { roleId: this.idPrefix + "foo" }],
      },
      default: {
        policies: [{ roleId: "default" }],
      },
      defaultfoo: {
        policies: [{ roleId: "default" }, { roleId: this.idPrefix + "foo" }],
      },
      emptyProfile: {
        policies: [],
      },
      invalidProfile: {
        policies: [{ roleId: "unexisting-role" }],
      },
      profile1: {
        policies: [{ roleId: this.idPrefix + "role1" }],
      },
      profile2: {
        policies: [
          {
            restrictedTo: [{ index: this.fakeIndex }],
            roleId: this.idPrefix + "role1",
          },
          {
            roleId: this.idPrefix + "role2",
          },
        ],
      },
      profile3: {
        policies: [
          {
            restrictedTo: [
              { collections: [this.fakeCollection], index: this.fakeAltIndex },
            ],
            roleId: this.idPrefix + "role2",
          },
        ],
      },
      profile4: {
        policies: [
          {
            roleId: this.idPrefix + "role3",
          },
        ],
      },
      profile5: {
        policies: [
          {
            restrictedTo: [{ index: this.fakeIndex }],
            roleId: this.idPrefix + "role3",
          },
        ],
      },
      profile6: {
        policies: [
          {
            restrictedTo: [
              { collections: [this.fakeCollection], index: this.fakeIndex },
            ],
            roleId: this.idPrefix + "role3",
          },
        ],
      },
    };

    this.users = {
      invalidprofileType: {
        content: {
          name: {
            first: "John",
            last: "Doe",
          },
          profileIds: [null],
        },
      },
      nocredentialuser: {
        content: {
          name: {
            first: "Non Connectable",
            last: "User",
          },
          profileIds: ["admin"],
        },
      },
      restricteduser1: {
        content: {
          name: {
            first: "Restricted",
            last: "User",
          },
        },
        credentials: {
          local: {
            password: "testpwd1",
            username: this.idPrefix + "restricteduser1",
          },
        },
      },
      unexistingprofile: {
        content: {
          name: {
            first: "John",
            last: "Doe",
          },
          profileIds: [this.idPrefix + "i-dont-exist"],
        },
      },
      user1: {
        content: {
          profileIds: [this.idPrefix + "profile1"],
        },
        credentials: {
          local: {
            password: "testpwd1",
            username: this.idPrefix + "user1",
          },
        },
      },
      user2: {
        content: {
          hobby: "Segway Polo",
          name: {
            first: "Steve",
            last: "Wozniak",
          },
          profileIds: [this.idPrefix + "profile2"],
        },
        credentials: {
          local: {
            password: "testpwd2",
            username: this.idPrefix + "user2",
          },
        },
      },
      user3: {
        content: {
          profileIds: [this.idPrefix + "profile3"],
        },
        credentials: {
          local: {
            password: "testpwd3",
            username: this.idPrefix + "user3",
          },
        },
      },
      user4: {
        content: {
          profileIds: [this.idPrefix + "profile4"],
        },
        credentials: {
          local: {
            password: "testpwd4",
            username: this.idPrefix + "user4",
          },
        },
      },
      user5: {
        content: {
          profileIds: [this.idPrefix + "profile5"],
        },
        credentials: {
          local: {
            password: "testpwd5",
            username: this.idPrefix + "user5",
          },
        },
        password: "testpwd5",
      },
      user6: {
        content: {
          profileIds: [this.idPrefix + "profile6"],
        },
        credentials: {
          local: {
            password: "testpwd6",
            username: this.idPrefix + "user6",
          },
        },
      },
      useradmin: {
        content: {
          name: {
            first: "David",
            last: "Bowie",
            real: "David Robert Jones",
          },
          profileIds: ["admin"],
        },
        credentials: {
          local: {
            password: "testpwd",
            username: this.idPrefix + "useradmin",
          },
        },
      },
    };

    this.credentials = {
      nocredentialuser: {
        password: "testpwd1",
        username: this.idPrefix + "nocredentialuser",
      },
    };

    this.memoryStorageResult = null;

    // Empty rather than absent: a step that reads what no earlier step wrote
    // then asserts on `undefined` and fails on its own assertion, which is
    // where the missing step shows up. The alternative is a `TypeError` in the
    // reader, which is where it used to show up.
    this.result = {};
    this.apiResult = {};
    this.updatedResult = {};
    this.body = {};

    this.currentToken = null;
    this.scrollId = null;
  }

  /**
   * A document fixture by the name a feature file gives it, falling back to
   * Grace Hopper's the way `this[documentName] || this.documentGrace` used to.
   * Indexing the world by a capture group reached every one of its properties;
   * only two of them are documents.
   */
  document(name?: string): ApiPayload {
    const documents: Record<string, ApiPayload> = {
      documentAda: this.documentAda,
      documentGrace: this.documentGrace,
    };

    return (name && documents[name]) || this.documentGrace;
  }
}

setWorldConstructor(KWorld);
setDefaultTimeout(30000);
