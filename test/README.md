# Unit testing
Tests the Kuzzle code using [mocha](http://mochajs.org/) and [should.js](https://github.com/shouldjs/should.js),
as well as [istanbul](https://gotwarlost.github.io/istanbul/) for test coverage.

## Running Unit Tests

    $ npm run unit-testing

## Running Unit Tests and report test coverage

    $ npm run unit-testing --coverage

Coverage report will be stored in ```coverage/``` directory:
* in json format : ```coverage/coverage.json```
* in HTML human readable format : ```coverage/lcov-report/index.html```
