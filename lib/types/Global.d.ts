declare global {
  namespace NodeJS {
    interface Global {
      kuzzle: any;
      app: any;
    }
  }
}

export {};
