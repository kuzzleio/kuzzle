"use strict";

/* A module that exports a class with no `init`: what `loadFromDirectory`
 * refuses, and the last thing it checks. */
class NotAPlugin {}

module.exports = NotAPlugin;
