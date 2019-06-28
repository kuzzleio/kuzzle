class Logger {
  constructor(eventEmitter) {
    this.eventEmitter = eventEmitter;
    this.logMethods = ['info', 'warn', 'error', 'silly', 'debug', 'verbose'];

    this._useConsole();

    this.eventEmitter.once('core:kuzzleStart', this._useLogger.bind(this));
  }

  _useConsole() {
    // until kuzzle has started, use the console to print logs
    for (const method of this.logMethods) {
      /* eslint-disable-next-line no-console */
      this[method] = console[method] || console.log;
    }
  }

  _useLogger() {
    // until kuzzle has started, use the console to print logs
    for (const method of this.logMethods) {
      this[method] =
        (...args) => this.eventEmitter.emit(`log:${method}`, args);
    }
  }
}

module.exports = Logger;
