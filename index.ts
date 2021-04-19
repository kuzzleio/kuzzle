export * from './lib/core/backend';

export * from './lib/types';

export * from './lib/core/plugin/pluginContext';

export * from './lib/core/shared/sdk/embeddedSdk';

export * from './lib/api/request';

export * from './lib/kerror/errors';

export * from './lib/util/mutex';

export * from './lib/util/inflector';

export * from 'kuzzle-sdk';

import KoncordeJS from 'koncorde';

export class Koncorde extends KoncordeJS {
  constructor (...args) {
    super(...args);
  }

  [key: string]: any;
}
