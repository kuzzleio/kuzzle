---
code: false
type: page
title: Command Line Interface (CLI)
order: 900
---

# Command Line Interface (CLI)

Kuzzle ships with a [Command line interface](https://en.wikipedia.org/wiki/Command-line_interface) which allows you to:

- Start Kuzzle
- Gracefully shutdown Kuzzle
- Create the first Administrator
- Reset Kuzzle internal data _(use with caution!)_
- Reset user created indexes _(use with caution!)_
- Reset users, roles and profiles _(use with caution!)_

* Load mappings, fixtures, roles, profiles and users

- Clear Kuzzle cache
- Diagnose the Kuzzle installation

The CLI is located in the `bin` folder of your Kuzzle installation.
If you have already created an admin, you will need to provide your login information to the CLI.
To get a list of commands and options run the CLI:

```bash
./bin/kuzzle

#   Usage: kuzzle [options] [command]
#
#
#   Commands:
#
#     createFirstAdmin           create the first administrator user
#     clearCache                 clear internal caches in Redis
#     reset                      reset all users, profiles, roles and documents validation specifications
#     resetSecurity              reset all users, profiles and roles
#     resetDatabase              remove all data stored on Kuzzle
#     shutdown                   gracefully exits after processing remaining requests
#     start [options]            start a Kuzzle instance
#     dump                       create a dump of current state of kuzzle
#     loadMappings <file>        load database mappings into Kuzzle
#     loadFixtures <file>        load database fixtures into Kuzzle
#     loadSecurities <file>      load roles, profiles and users into Kuzzle
#     encryptSecrets [file] [options]  encrypt a secrets file with the provided key
#     decryptSecrets [file] [options]  decrypt a secrets file with the provided key
#
#   Options:
#
#     -h, --help                 output usage information
#     -V, --version              output the version number
#     -p, --port <port>          Kuzzle port number
#     -h, --host <host>          Kuzzle host
#     -U, --username <username>  Admin username
#     -P, --password <password>  Admin password
#     -d, --debug                make errors more verbose
#     -C, --noColors             do not use ANSI coloring
```

---

## createFirstAdmin

```bash
./bin/kuzzle createFirstAdmin
```

When Kuzzle runs for the first time, no users are defined and the anonymous user is granted full access rights.

The `createFirstAdmin` command lets you create an administrator to manage security.

This call the action [security#createFirstAdmin](/core/1/api/controllers/security/create-first-admin/)

---

## clearCache

```bash
./bin/kuzzle clearCache
```

Kuzzle uses Redis to store frequently accessed internal data. Use this command if you need to clear this data (cache).

This call the action [admin#resetCache](/core/1/api/controllers/admin/reset-cache/)

---

## dump

```bash
./bin/kuzzle dump

# [ℹ] Creating dump file...
# [✔] Done!
#
# [ℹ] Dump has been successfully generated in "dump/<date>-<time>-cli" folder
# [ℹ] You can send the folder to the kuzzle core team at support@kuzzle.io
```

The `dump` command creates a snapshot of the state of Kuzzle, including:

- a coredump of Kuzzle
- the current Kuzzle configuration
- server logs
- Node.js binary & properties
- a list of OS properties
- plugins configuration
- usage statistics of the dumped instance

The generated directory can be used to feed a crash report to the support team.

This call the action [admin#dump](/core/1/api/controllers/admin/reset-security/)

---

## reset

```bash
./bin/kuzzle reset --help

#    Usage: reset [options]
#
#    reset all users, profiles, roles and documents validation specifications
#
#    Options:
#
#      -h, --help             output usage information
#      --noint                non interactive mode
```

Asynchronously start the following sequence in Kuzzle, in this order:

- Invalidate and delete all users along with their credentials
- Delete all user-defined roles and profiles
- Reset the default roles and profiles to their default values
- Delete all document validation specifications

This action has no impact on Plugin and Document storage.

This call the action [admin#resetKuzzleData](/core/1/api/controllers/admin/reset-kuzzle-data/)

---

## resetSecurity

<SinceBadge version="1.4.0" />

```bash
./bin/kuzzle resetSecurity --help

#    Usage: resetSecurity [options]
#
#    reset all users, profiles and roles
#
#    Options:
#
#      -h, --help             output usage information
#      --noint                non interactive mode
```

The `resetSecurity` command deletes all created users, profiles and roles and reset the default roles and profiles : `anonymous`, `admin` and `default`.

This call the action [admin#resetSecurity](/core/1/api/controllers/admin/reset-security/)

---

## resetDatabase

<SinceBadge version="1.4.0" />

```bash
./bin/kuzzle resetDatabase --help

#    Usage: resetDatabase [options]
#
#    delete all data stored on Kuzzle
#
#    Options:
#
#      -h, --help             output usage information
#      --noint                non interactive mode
```

The `resetDatabase` delete all indexes created by users. This does not include Kuzzle's internal index.

This call the action [admin#resetDatabase](/core/1/api/controllers/admin/reset-database/)

Note: this command has no impact on any plugins stored data, or on any Kuzzle stored documents.

---

## shutdown

```bash
./bin/kuzzle shutdown

# [ℹ] Shutting down...
# [✔] Done!
```

The `shutdown` command lets you stop a Kuzzle instance after any remaining requests are processed, ensuring that no unnecessary `Service Unavailable` errors are returned to connected clients.

This call the action [admin#shutdown](/core/1/api/controllers/admin/shutdown/)

---

## start

```bash
./bin/kuzzle start --help

#    Usage: start [options]
#
#    start a Kuzzle instance
#
#    Options:
#
#      -h, --help                        output usage information
#          --fixtures <file>             import data from file
#          --mappings <file>             apply mappings from file
#          --securities <file>           import roles, profiles and users from file
#          --vault-key <vaultKey>        Vault key used to decrypt secrets
#          --secrets-file <secretsFile>  Output file to write decrypted secrets

```

The `start` command starts a Kuzzle instance.

Using this command you can also initialize the storage layer mappings, using the mappings `--mappings` options, and the storage layer documents using the `--fixtures` option.

#### `--mappings`

Loads mappings from a file and apply them to the storage layer.

The input file must be a JSON file with the following structure:

```json
{
  "index": {
    "collection": {
      "properties": {
        "field1": {},
        "field2": {},
        "field...": {}
      }
    }
  }
}
```

**Notes:**

- The file can contain any number of index and collection configurations.
- Field definitions follow the [Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/5.6/mapping.html) mapping format.
- If an index or collection does not exist, it will be created automatically.
- Mappings are loaded sequentially, one index/collection pair at a time. If a failure occurs, Kuzzle immediately interrupts the sequence.
- Mappings can be replayed across multiple Kuzzle start sequences, as long as they do not change in-between.

**Example:**

```json
{
  "foo": {
    "bar": {
      "properties": {
        "foobar": { "type": "keyword" },
        "barfoo": { "type": "integer" }
      }
    },
    "baz": {
      "properties": {
        "created": {
          "type": "date",
          "format": "strict_date_optional_time||epoch_millis"
        },
        "other": { "type": "text" }
      }
    }
  }
}
```

#### `--fixtures`

Reads documents from a file and loads them into the storage layer.

The file must be a JSON file with the following structure:

```json
{
  "index": {
    "collection": [
      {"<command>": {}},
      {"field": "value", "field2": "value", "field...", "value"}
    ]
  }
}
```

**Notes:**

- The file can contain any number of index and collection configurations.
- Each collection contains an array of data to load, just like the [bulk:import API](/core/1/api/controllers/bulk/import/).
- If an index or collection does not exist, the load will fail.
- Fixtures are loaded sequentially, one index/collection pair at a time. If a failure occurs, Kuzzle immediately interrupts the sequence.

**Example:**

```json
{
  "foo": {
    "bar": [
      { "index": {} },
      { "field": "foo", "another_field": 42 },
      { "index": {} },
      { "field": "foo", "another_field": 42 }
    ],
    "baz": [{ "index": {} }, { "bar": "baz", "qux": ["q", "u", "x"] }]
  }
}
```

#### `--securities`

Read roles, profiles and users from a file and loads them into the storage layer.

The file must be a JSON file with the following structure:

```json
{
  "roles": {
    "role-id": {
      /* role definition */
    }
  },
  "profiles": {
    "profile-id": {
      /* profile definition */
    }
  },
  "users": {
    "user-id": {
      /* user definition */
    }
  }
}
```

The roles, profiles and users definition follow the same structure as in the body parameter of the API:

- [createRole](/core/1/api/controllers/security/create-role/)
- [createProfile](/core/1/api/controllers/security/create-profile/)
- [createUser](/core/1/api/controllers/security/create-user/)

**Notes:**

- The file can contain any number of roles, profiles and users.
- If a role, profile or user already exists, it will be replaced.
- Fixtures are loaded sequentially, first the roles, then the profiles and finally the users. If a failure occurs, Kuzzle immediately interrupts the sequence.

**Example:**

```json
{
  "roles": {
    "role-id-1": {
      "controllers": {
        "*": {
          "actions": {
            "*": true
          }
        }
      },
      "role-id-2": {
        "controllers": {
          "*": {
            "actions": {
              "*": true
            }
          }
        }
      }
    },
    "profiles": {
      "profile-id-1": {
        "policies": [
          {
            "roleId": "role-id-1",
            "restrictedTo": []
          }
        ]
      },
      "profile-id-2": {
        "policies": [
          {
            "roleId": "role-id-2",
            "restrictedTo": []
          }
        ]
      }
    },
    "users": {
      "user-id-1": {
        "content": {
          "profileIds": ["profile-id-1"]
        },
        "credentials": {
          "local": {
            "username": "nina",
            "password": "thug"
          }
        }
      },
      "user-id-2": {
        "content": {
          "profileIds": ["profile-id-2"]
        },
        "credentials": {
          "local": {
            "username": "alyx",
            "password": "vance"
          }
        }
      }
    }
  }
}
```

---

## loadMappings

<SinceBadge version="1.6.6" />

```bash
./bin/kuzzle loadMappings <file>

# [✔] Mappings have been successfully loaded
```

The `loadMappings` command applies mappings directly into the storage layer.

### Mappings file example

```js
{
  "index-name": {
    "collection-name": {
      "properties": {
        "field1": { "type": "keyword" },
        "field2": { "type": "integer" },
        "field...": { "type": "..." }
      }
    }
  }
}
```

**Notes:**

- The mapping can contain any number of index and collection configurations.
- Field definitions follow the [Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/5.6/mapping.html) mapping format.
- If an index or collection does not exist, it will be created automatically.
- Mappings are loaded sequentially, one index/collection pair at a time. If a failure occurs, Kuzzle immediately interrupts the sequence.

---

## loadFixtures

<SinceBadge version="1.6.6" />

```bash
./bin/kuzzle loadFixtures <file>

# [✔] Fixtures have been successfully loaded
```

The `loadFixtures` command loads fixtures directly into the storage layer.

### Fixtures file example

```js
{
  "index-name": {
    "collection-name": [
      {"create": { "_id": "uniq-id-123456" }},
      {"field": "value", "field2": "value", "field...", "value"}
    ]
  }
}
```

**Notes:**

- The fixtures can contain any number of index and collection configurations.
- Each collection contains an array of data to load, just like the [bulk:import](/core/1/api/controllers/bulk/import) method.
- If an index or collection does not exist, the load will fail.
- Fixtures are loaded sequentially, one index/collection pair at a time. If a failure occurs, Kuzzle immediately interrupts the sequence.

---

## loadSecurities

<SinceBadge version="1.6.6" />

```bash
./bin/kuzzle loadSecurities <file>

# [✔] Securities have been successfully loaded
```

The `loadSecurities` command loads roles, profiles and users directly into the storage layer.

The roles, profiles and users definition follow the same structure as in the body parameter of the API:

- [security:createRole](/core/1/api/controllers/security/create-role)
- [security:createProfile](/core/1/api/controllers/security/create-profile)
- [security:createUser](/core/1/api/controllers/security/create-user)

### Securities file example

```js
{
  "roles": {
    "role-id": {
      /* role definition */
    }
  },
  "profiles": {
    "profile-id": {
      /* profile definition */
    }
  },
  "users": {
    "user-id": {
      /* user definition */
    }
  }
}
```

**Notes:**

- The file can contain any number of roles, profiles and users.
- If a role, profile or user already exists, it will be replaced.
- Fixtures are loaded sequentially, first the roles, then the profiles and finally the users. If a failure occurs, Kuzzle immediately interrupts the sequence.

## encryptSecrets

<SinceBadge version="1.8.0" />

```bash
./bin/kuzzle encryptSecrets [file] [options]

Options:
      --vault-key <vaultKey>     Vault key used to encrypt secrets
      --outputFile <outputFile>  Output file to write encrypted secrets
      --noint                    non interactive mode
```

Encrypts the provided `file` with the provided `vaultKey`.  
The `vaultKey` can be either provided in the command line or in the `KUZZLE_VAULT_KEY` environment variable.  
The `file` can be provided in the command line or in the default secrets file in `<kuzzle dir>/config/secrets.json`.

::: info
See also [Secrets Vault](/core/1/guides/essentials/secrets-vault)
:::

## decryptSecrets

<SinceBadge version="1.8.0" />

```bash
./bin/kuzzle decryptSecrets [file] [options]

Options:
      --vault-key <vaultKey>     Vault key used to encrypt secrets
      --outputFile <outputFile>  Output file to write encrypted secrets
      --noint                    non interactive mode
```

Decrypts the provided `file` with the provided `vaultKey`.  
The `vaultKey` can be either provided in the command line or in the `KUZZLE_VAULT_KEY` environment variable.  
The `file` can be provided in the command line, through the `KUZZLE_SECRETS_FILE` environment variable or in the default secrets file in `<kuzzle dir>/config/secrets.enc.json`.

::: info
See also [Secrets Vault](/core/1/guides/essentials/secrets-vault)
:::
