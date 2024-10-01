import { Backend } from "../core/backend";
import { Kuzzle } from "../kuzzle/kuzzle";

/**
 * This file contains global type declarations for Kuzzle.
 * We need to use `var` so Typescript extends the globalThis type.
 * See https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#type-checking-for-globalthis
 */

/* eslint-disable no-var, vars-on-top */

declare global {
  var app: Backend;
  var kuzzle: Kuzzle;
  var NODE_ENV: string;
}

global.NODE_ENV = process.env.NODE_ENV;

export {};

/* eslint-enable no-var, vars-on-top*/
