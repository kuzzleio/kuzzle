declare global {
  namespace NodeJS {
    interface Global {
      kuzzle: any;
    }
  }
}

export {};
