'use strict';

// Starts a Kuzzle Backend application tailored for development
// This loads a special plugin dedicated to functional tests

import should from 'should'
import { omit } from 'lodash'

import { Backend, Request } from '../../index';
import { FunctionalTestsController } from './functional-tests-controller';

const app = new Backend('functional-tests-app');

async function loadAdditionalPlugins () {
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

    const options = manifest !== null
      ? { manifest, name: manifest.name }
      : null;

    app.plugin.use(new Plugin(), options);
  }
}

if (! process.env.TRAVIS) {
  // Easier debug
  app.hook.register('request:onError', (request: Request) => {
    console.log(request.error);
  });
  app.hook.register('hook:onError', (request: Request) => {
    console.log(request.error);
  });
}

// Controller class usage
app.controller.use(new FunctionalTestsController(app));

// Pipe management
const activatedPipes: any = {};

app.controller.register('pipes', {
  actions: {
    deactivateAll: {
      handler: async () => {
        const values: any = Object.values(activatedPipes);

        for (const pipe of values) {
          pipe.state = 'off';
        }

        return null;
      }
    },
    manage: {
      handler: async (request: Request) => {
        const payload = request.input.body;
        const state = request.input.args.state;
        const event = request.input.args.event;

        activatedPipes[event] = {
          payload,
          state,
        };

        return null;
      }
    }
  }
});

/* Actual code for tests start here */

// Pipe registration
app.pipe.register('server:afterNow', async request => {
  const pipe = activatedPipes['server:afterNow'];

  if (pipe && pipe.state !== 'off') {
    request.response.result = { coworking: 'Spiced' };
  }

  return request;
});

// Hook registration and embedded SDK realtime publish
app.hook.register('custom:event', async name => {
  await app.sdk.realtime.publish(
    'app-functional-test',
    'hooks',
    { event: 'custom:event', name });
});

app.controller.register('tests', {
  actions: {
    // Controller registration and http route definition
    sayHello: {
      handler: async (request: Request) => {
        return { greeting: `Hello, ${request.input.args.name}` };
      },
      http: [{ verb: 'post', path: '/hello/:name' }]
    },

    // Trigger custom event
    triggerEvent: {
      handler: async (request: Request) => {
        await app.trigger('custom:event', request.input.args.name);

        return { trigger: 'custom:event', payload: request.input.args.name }
      }
    },

    // Access Vault secrets
    vault: {
      handler: async () => app.vault.secrets
    },

    // access storage client
    storageClient: {
      handler: async (request: Request) => {
        const client = new app.storage.ESClient();
        const esRequest = {
          body: request.input.body,
          id: request.input.resource._id,
          index: request.input.resource.index,
        };

        const response = await client.index(esRequest);
        const response2 = await app.storage.esClient.index(esRequest);

        should(omit(response.body, ['_version', 'result', '_seq_no']))
          .match(omit(response2.body, ['_version', 'result', '_seq_no']));

        return response.body;
      },
      http: [
        { verb: 'post', path: '/tests/storage-client/:index' }
      ]
    }
  }
});

let vaultfile = 'features-sdk/fixtures/secrets.enc.json';
if (process.env.SECRETS_FILE_PREFIX) {
  vaultfile = process.env.SECRETS_FILE_PREFIX + vaultfile;
}
app.vault.file = vaultfile;
app.vault.key = 'secret-password';

loadAdditionalPlugins()
  .then(() => app.start())
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
