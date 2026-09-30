"use strict";

/* A plugin as it exists on disk: a CommonJS module exporting a class with an
 * `init`. `Plugin.loadFromDirectory` requires this path at runtime, so it has
 * to be a real file — that is what the code under test does. */
class LambdaCore {
  init() {}
}

module.exports = LambdaCore;
