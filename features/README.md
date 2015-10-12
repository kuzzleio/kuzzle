#Functional testing

Tests features using [cucumber.js](https://cucumber.io/docs/reference/javascript).

It is recommended to launch these tests from within a Kuzzle docker container, to avoid the hassle of installing all the needed dependencies.

See the [Getting Started](../README.md) documentation for more information about installing Kuzzle.

## Running Functional Tests

    $ npm run functional-testing

If your Kuzzle instance use a different configuration than the default one, you can make these tests point at other locations by editing the `.kuzzlerc` file at the root directory.

## Running Functional Tests and report test coverage

    $ npm run functional-testing && npm run crawl-coverage

Coverage report will be stored in HTML human readable format : ```coverage/features/coverage.html```
