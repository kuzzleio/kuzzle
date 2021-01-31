/* eslint-disable @typescript-eslint/no-namespace */

declare global {
  namespace NodeJS {
    interface Global {
      kuzzle: any;
      NODE_ENV: string;
    }
  }
}

global.NODE_ENV = process.env.NODE_ENV;

export {};

/* eslint-enable @typescript-eslint/no-namespace */
