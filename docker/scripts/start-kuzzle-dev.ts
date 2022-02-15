'use strict';

// Starts a Kuzzle Backend application tailored for development
// This loads a special plugin dedicated to functional tests

import should from 'should/as-function';
import { omit } from 'lodash';

import { Backend, KuzzleRequest, Mutex } from '../../index';
import { FunctionalTestsController } from './functional-tests-controller';
import functionalFixtures from '../../features/fixtures/imports.json';

const app = new Backend('functional-tests-app');

async function loadAdditionalPlugins() {
  const additionalPluginsIndex = process.argv.indexOf('--enable-plugins');
  const additionalPlugins = additionalPluginsIndex > -1
      ? process.argv[additionalPluginsIndex + 1].split(',')
      : [];

  for (const name of additionalPlugins) {
    const path = `../../plugins/available/${name}`;
    const { default: Plugin } = await import(path);

    let manifest = null;

    try {
      manifest = require(`${path}/manifest.json`);
    }
    catch (e) {
      // do nothing
    }

    const options = manifest !== null ? { manifest, name: manifest.name } : null;

    app.plugin.use(new Plugin(), options);
  }
}

if (! process.env.TRAVIS) {
  // Easier debug
  app.hook.register('request:onError', async (request: KuzzleRequest) => {
    app.log.error(request.error);
  });

  app.hook.register('hook:onError', async (request: KuzzleRequest) => {
    app.log.error(request.error);
  });
}

// Controller class usage
app.controller.use(new FunctionalTestsController(app));

// Pipe management
app.controller.register('pipes', {
  actions: {
    deactivateAll: {
      handler: async () => {
        const names: any = await app.sdk.ms.keys('app:pipes:*');

        for (const name of names) {
          const pipe = JSON.parse(await app.sdk.ms.get(name));
          pipe.state = 'off';
          await app.sdk.ms.set(name, JSON.stringify(pipe));
        }

        return null;
      },
    },
    manage: {
      handler: async (request: KuzzleRequest) => {
        const payload = request.input.body;
        const state = request.input.args.state;
        const event = request.input.args.event;

        await app.sdk.ms.set(`app:pipes:${event}`, JSON.stringify({
          payload,
          state,
        }));

        return null;
      },
    },
  },
});

/* Actual code for tests start here */

// Pipe registration
app.pipe.register('server:afterNow', async (request) => {
  const pipe = JSON.parse(await app.sdk.ms.get('app:pipes:server:afterNow'));

  if (pipe && pipe.state !== 'off') {
    request.response.result = { coworking: 'Spiced' };
  }

  return request;
});

// Hook registration and embedded SDK realtime publish
app.hook.register('custom:event', async (name) => {
  await app.sdk.realtime.publish('app-functional-test', 'hooks', {
    event: 'custom:event',
    name,
  });
});

let syncedHello = 'World';
let dynamicPipeId;

app.openApi.definition.components.LogisticObjects = {
  Item: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'integer' },
    }
  }
};

app.controller.register('openapi-test', {
  actions: {
    hello: {
      handler: async () => ({ hello: 'world' }),
      http: [
        {
          verb: 'post',
          path: '/openapi-test/:company/:objectType/:_id',
          openapi: {
            description: 'Creates a new Logistic Object',
            parameters: [
              {
                in: 'body',
                description: 'Content of the Logistic Object',
                required: true,
                schema: {
                  $ref: '#/components/LogisticObjects/Item'
                },
              }
            ],
            responses: {
              200: {
                description: "Custom greeting",
                content: {
                  "application/json": {
                    schema: {
                      type: "string",
                    }
                  }
                }
              }
            }
          }
        }
      ]
    }
  }
});

app.controller.register('tests', {
  actions: {
    // Controller registration and http route definition
    sayHello: {
      handler: async (request: KuzzleRequest) => {
        return { greeting: `Hello, ${request.input.args.name}` };
      },
      http: [{ verb: 'post', path: '/hello/:name' }],
    },

    getSyncedHello: {
      handler: async (request: KuzzleRequest) => `Hello, ${syncedHello}`,
      http: [{ verb: 'get', path: '/hello' }],
    },

    syncHello: {
      handler: async (request: KuzzleRequest) => {
        syncedHello = request.input.args.name;
        await app.cluster.broadcast('sync:hello', { name: syncedHello });
        return 'OK';
      },
      http: [{ verb: 'put', path: '/syncHello/:name' }],
    },

    // Trigger custom event
    triggerEvent: {
      handler: async (request: KuzzleRequest) => {
        await app.trigger('custom:event', request.input.args.name);

        return { trigger: 'custom:event', payload: request.input.args.name };
      },
    },

    // Access Vault secrets
    vault: {
      handler: async () => app.vault.secrets,
    },

    // Access storage client
    storageClient: {
      handler: async (request: KuzzleRequest) => {
        const client = new app.storage.StorageClient();
        const esRequest = {
          body: request.input.body,
          id: request.input.args._id,
          index: request.input.args.index,
        };

        const response = await client.index(esRequest);
        const response2 = await app.storage.storageClient.index(esRequest);

        should(omit(response.body, ['_version', 'result', '_seq_no'])).match(
          omit(response2.body, ['_version', 'result', '_seq_no'])
        );

        return response.body;
      },
      http: [{ verb: 'post', path: '/tests/storage-client/:index' }],
    },

    // Mutex class
    mutex: {
      handler: async (request: KuzzleRequest) => {
        const ttl = 5000;
        const mutex = new Mutex('functionalTestMutexHandler', {
          timeout: 0,
          ttl,
        });

        const locked = await mutex.lock();

        return { locked };
      },
      http: [{ verb: 'get', path: '/tests/mutex/acquire' }],
    },

    // Dynamic pipe registration
    'register-pipe': {
      handler: async () => {
        dynamicPipeId = app.pipe.register(
          'server:afterNow',
          async request => {
            request.result.name = 'Ugo';

            return request;
          },
          { dynamic: true });

        return dynamicPipeId;
      }
    },
    'unregister-pipe': {
      handler: async () => {
        app.pipe.unregister(dynamicPipeId);
      }
    },
  },
});

let vaultfile = 'features/fixtures/secrets.enc.json';
if (process.env.SECRETS_FILE_PREFIX) {
  vaultfile = process.env.SECRETS_FILE_PREFIX + vaultfile;
}
app.vault.file = vaultfile;
app.vault.key = 'secret-password';

// Ensure imports before startup are working
app.import.mappings(functionalFixtures.mappings)
app.import.profiles(functionalFixtures.profiles)
app.import.roles(functionalFixtures.roles)
app.import.userMappings(functionalFixtures.userMappings)
app.import.users(functionalFixtures.users, { onExistingUsers: 'overwrite' })

loadAdditionalPlugins()
  .then(() => app.start())
  .then(async () => {
    // post-start methods here

    // Cluster synchronization
    await app.cluster.on('sync:hello', (payload) => {
      syncedHello = payload.name;
    });
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
