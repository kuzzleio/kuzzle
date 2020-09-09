'use strict';

import should from 'should'
import { omit } from 'lodash'

import { Backend } from '../../index';
import FunctionalTestPlugin from '../../plugins/available/functional-test-plugin';
import { FunctionalTestsController } from './functional-tests-controller';

const app = new Backend('functional-tests-app');

if (! process.env.TRAVIS) {
  // Easier debug
  app.hook.register('request:onError', request => {
    console.log(request.error);
  });
  app.hook.register('hook:onError', request => {
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
      handler: async request => {
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
      handler: async request => {
        return { greeting: `Hello, ${request.input.args.name}` };
      },
      http: [{ verb: 'POST', path: '/hello/:name' }]
    },

    // Trigger custom event
    triggerEvent: {
      handler: async request => {
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
      handler: async request => {
        const client = new app.storage.Client();
        const esRequest = {
          body: request.input.body,
          id: request.input.resource._id,
          index: request.input.resource.index,
        };

        const response = await client.index(esRequest);
        const response2 = await app.storage.client.index(esRequest);

        should(omit(response.body, ['_version', 'result', '_seq_no']))
          .match(omit(response2.body, ['_version', 'result', '_seq_no']));

        return response.body;
      },
      http: [
        { verb: 'POST', path: '/tests/storage-client/:index' }
      ]
    }
  }
});

app.plugin.use(new FunctionalTestPlugin());

let vaultfile = 'features-sdk/fixtures/secrets.enc.json';
if (process.env.SECRETS_FILE_PREFIX) {
  vaultfile = process.env.SECRETS_FILE_PREFIX + vaultfile;
}
app.vault.file = vaultfile;
app.vault.key = 'secret-password';

app.start().catch(error => {
  console.error(error);
  process.exit(1);
});
