/* eslint-disable @typescript-eslint/no-namespace */

declare global {
  namespace NodeJS {
    interface Global {
      kuzzle: any;
    }
  }
}

export {};

/* eslint-enable @typescript-eslint/no-namespace */
