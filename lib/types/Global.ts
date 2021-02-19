import { Backend } from '../core/backend';

/* eslint-disable @typescript-eslint/no-namespace */

declare global {
  namespace NodeJS {
    interface Global {
      kuzzle: any;
      app: Backend;
      NODE_ENV: string;
    }
  }
}

global.NODE_ENV = process.env.NODE_ENV;

export {};

/* eslint-enable @typescript-eslint/no-namespace */
