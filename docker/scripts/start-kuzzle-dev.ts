'use strict';

// Starts a Kuzzle Backend application tailored for development
// This loads a special plugin dedicated to functional tests

import should from 'should';
import { omit } from 'lodash';

import { Backend, Request, Mutex } from '../../index';
import { FunctionalTestsController } from './functional-tests-controller';

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
  app.hook.register('request:onError', async (request: Request) => {
    app.log.error(request.error);
  });

  app.hook.register('hook:onError', async (request: Request) => {
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
      handler: async (request: Request) => {
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

app.controller.register('tests', {
  actions: {
    // Controller registration and http route definition
    sayHello: {
      handler: async (request: Request) => {
        return { greeting: `Hello, ${request.input.args.name}` };
      },
      http: [{ verb: 'post', path: '/hello/:name' }],
    },

    getSyncedHello: {
      handler: async (request: Request) => `Hello, ${syncedHello}`,
      http: [{ verb: 'get', path: '/hello' }],
    },

    syncHello: {
      handler: async (request: Request) => {
        syncedHello = request.input.args.name;
        await app.cluster.broadcast('sync:hello', { name: syncedHello });
        return 'OK';
      },
      http: [{ verb: 'put', path: '/syncHello/:name' }],
    },

    // Trigger custom event
    triggerEvent: {
      handler: async (request: Request) => {
        await app.trigger('custom:event', request.input.args.name);

        return { trigger: 'custom:event', payload: request.input.args.name };
      },
    },

    // Access Vault secrets
    vault: {
      handler: async () => app.vault.secrets,
    },

    // access storage client
    storageClient: {
      handler: async (request: Request) => {
        const client = new app.storage.StorageClient();
        const esRequest = {
          body: request.input.body,
          id: request.input.resource._id,
          index: request.input.resource.index,
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

    mutex: {
      handler: async (request: Request) => {
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
  },
});

let vaultfile = 'features/fixtures/secrets.enc.json';
if (process.env.SECRETS_FILE_PREFIX) {
  vaultfile = process.env.SECRETS_FILE_PREFIX + vaultfile;
}
app.vault.file = vaultfile;
app.vault.key = 'secret-password';

loadAdditionalPlugins()
  .then(() => app.start())
  .then(() => {
    // post-start methods here

    app.cluster.on('sync:hello', (payload) => {
      syncedHello = payload.name;
    });
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
