/* eslint-disable @typescript-eslint/no-namespace */

declare global {
  namespace NodeJS {
    interface Global {
      kuzzle: any;
      app: any;
      NODE_ENV: string;
    }
  }
}

global.NODE_ENV = process.env.NODE_ENV;

export {};

/* eslint-enabl2e @typescript-eslint/no-namespace */
