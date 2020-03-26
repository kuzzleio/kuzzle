---
code: false
type: page
title: Command Line Interface
order: 900
---

# Kourou - Command Line Interface (CLI)

A [Command line interface](https://en.wikipedia.org/wiki/Command-line_interface) is available for Kuzzle as a separate NPM package.  

This CLI connects to the Kuzzle API and allows you to perform tasks like:

- Manage API keys
- Add secrets to the vault
- Export and import collections
- Execute raw query
- ...

::: warning
The old Kuzzle CLI has been deprecated but the package is still available on NPM: https://github.com/kuzzleio/kuzzle-cli/
:::

## Installation

To install the CLI globally, you can use the following command: `npm install -g kourou`

## Connect and authenticate to Kuzzle API

Commands that need to send requests to the Kuzzle API can specify the Kuzzle server address and authentication informations.

By command line:
```
  -h, --host=host                [default: localhost] Kuzzle server host
  -p, --port=port                [default: 7512] Kuzzle server port
  --username=username            [default: anonymous] Kuzzle user
  --password=password            Kuzzle user password
  --ssl                          [default: true for port 443] Use SSL to connect to Kuzzle
```

By environment variables:
```
  KUZZLE_HOST                [default: localhost] Kuzzle server host
  KUZZLE_PORT                [default: 7512] Kuzzle server port
  KUZZLE_USERNAME            [default: anonymous] Kuzzle user
  KUZZLE_PASSWORD            Kuzzle user password
  KUZZLE_SSL                 Use SSL to connect to Kuzzle
```

## Available commands

::: warning
Kourou is still in beta and breaking changes may occur until the 1.0.0 version is released. 
:::

See the complete documentation on Github: [https://github.com/kuzzleio/kourou/](https://github.com/kuzzleio/kourou/)
