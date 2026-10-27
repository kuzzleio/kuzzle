---
code: false
type: branch
order: 100
title: Upgrading Kuzzle | Migrate from Kuzzle 1.x | Guide | Core
meta:
  - name: description
    content: Kuzzle can either be made in place, or by importing data from a Kuzzle v1 instance into a fresh v2 infrastucture.
  - name: keywords
    content: Kuzzle, Documentation, kuzzle write pluggins, Upgrading kuzzle
---

# Upgrading Kuzzle

As for any product, releasing a new major version means many exciting changes, but also a lot of breaking changes forcing users to adapt.

The exhaustive list of breaking changes is available here: [link](/core/2/guides/migrate-from-v1/changes).

Kuzzle can either be made in place, or by importing data from a Kuzzle v1 instance into a fresh v2 infrastucture.

## New Kuzzle stack 

Simply follow our standard install procedure, and run our upgrade script (see below).

The choice will be proposed to import data from a different Elasticsearch instance than the one detected.

## In-place migration

First, shut down the Kuzzle v1 instance, but keep the Elasticsearch server running.

Upgrade Kuzzle source files (either in place, or by installing them in another directory).

Run the upgrade script (see below): a choice will be proposed to migrate using the same Elasticsearch instance as the target.

At the end of the script, if everything went well, it will ask permission to destroy the previously upgraded structure. This is the *only* point of no-return: if you accept, then it cannot be reverted.

The next step is to upgrade Elasticsearch to v7.0 or above ([Elasticsearch upgrade documentation](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/setup-upgrade.html)).

Once done, Kuzzle v2 can be started.

## Upgrade script

::: warning
The upgrade script was removed in Kuzzle 2.32.0: it was last shipped with Kuzzle 2.31. To migrate from Kuzzle v1, run the script of [Kuzzle 2.31](https://github.com/kuzzleio/kuzzle/tree/v2.31.0/bin) first, then upgrade to the latest Kuzzle v2 version. You can also [export your data](/core/2/guides/advanced/export-import-data) from Kuzzle v1 and import it into a new Kuzzle v2 stack.
:::

Kuzzle v2, up to version 2.31, comes with an upgrade script, making it easier to migrate from the previous version.

To start the script, launch `bin/upgrade --help` from a Kuzzle 2.31 installation and follow the instructions.

The script is idempotent: it can be restarted any number of times, without any danger to your data storage.

*Except* if you choose to destroy the upgraded storage structure, which is only proposed for in-place migrations, and after every other operations are successful.

### Limitations

The script upgrades the following:
- configuration files
- internal storage: security configuration, users, token seed, ...
- public and plugin-dedicated storages
- cache: users can continue using their active tokens after a successful upgrade

Other breaking changes, especially those involving the API, must be dealt with manually.

