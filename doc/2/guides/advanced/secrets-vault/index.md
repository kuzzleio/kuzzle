---
code: false
type: page
order: 300
title: Secrets Vault | Kuzzle Advanced | Guide | Core
meta:
  - name: description
    content: Securely store your application secrets
  - name: keywords
    content: Kuzzle, Documentation, kuzzle write pluggins, General purpose backend, opensource, d-shrinkwrap This version of npm is compatible with lockfileVersion@1, but package-lock.json was generated for lockfileVersion@2. I'll try to do my best with it!
npm WARN deprecated docsearch.js@2.6.3: This package has been deprecated and is no lonSecrets Vault
---
# Secrets Vault

When you develop an application with Kuzzle, you may **need to use secrets** such as API keys or authentication information.

Of course, it is unacceptable to version these secrets in cleartext with the rest of your source code.

However, it is still practical to be able to share these secrets with the rest of your team, or to add them to the repository for automated production.

Kuzzle **offers a secure storage system for these secrets**, the operation is as follows:
  - writing secrets to a JSON file,
  - manual encryption of this file with a password,
  - adding the encrypted file to the repository,
  - automatic decryption of the file when Kuzzle starts,
  - exposing the secrets in the context of plugins.

Thus, the **only secret that it is necessary to communicate** to the rest of a team is **the encryption password** for this file.

See this project on [Github](https://github.com/kuzzleio/kuzzle-vault).

## Secrets file format

The secrets file is in JSON format. String values are encrypted but the key names remain the same.

```js
/* config/secrets.json */
{
  "aws": {
    "secretKeyId": "lfiduras"
  },
  "cloudinaryKey": "ho-chi-minh"
}
```

Once encrypted, the file looks like the following:

```js
/* config/secrets.enc.json */
{
  "aws": {
    "secretKeyId": "536553f3181ada6f700cac98100f1266.3181ada66536553f"
  },
  "cloudinaryKey": "f700cac98100f1266536553f3181ada6.6536553f3181ada"
}
```

## Encrypt and decrypt with the CLI

The encryption of a secret file is done using [Kourou](https://github.com/kuzzleio/kourou), the Kuzzle CLI with the following command:

```bash
kourou vault:encrypt config/secrets.json --vault-key strongpassword
[ℹ] Encrypting secrets...
[✔] Secrets successfully encrypted: config/secrets.enc.json
```

The file `config/secrets.enc.json` can be added safely to the project repository.

To decrypt a previously encrypted file, use the following command:

```bash
kourou vault:decrypt config/secrets.enc.json --vault-key strongpassword
[ℹ] Decrypting secrets...
[✔] Secrets successfully encrypted: config/secrets.json
```

::: info
You can also specify the vault key in the `KUZZLE_VAULT_KEY` environment variable.
:::

You can see the complete list of Kuzzle Vault related commands in Kourou on [Github](https://github.com/kuzzleio/kourou/#kourou-vaultadd-secrets-file-key-value).

## Load encrypted secrets at startup

Kuzzle will try to decrypt the provided file using the following locations, in that order of priority:
  - in the [app.vault.file](/core/2/framework/classes/backend-vault/properties) property: `app.vault.file = './secrets.env.json';`
  - in an environment variable `export KUZZLE_SECRETS_FILE=/var/secrets.enc.json`
  - the default one present at the location `<kuzzle dir>/config/secrets.enc.json`

The decryption key must be provided in one of the following ways, in order of priority as well:
  - in the [app.vault.key](/core/2/framework/classes/backend-vault/properties) property: `app.vault.key = 'verystrongpassword';`
  - in an environment variable `export KUZZLE_VAULT_KEY=verystrongpassword`

::: warning
Kuzzle start sequence ends in failure if:
  - a decryption key is provided and Kuzzle cannot find a file
  - Kuzzle finds a file and no decryption key is provided
  - a file is provided but Kuzzle cannot read it
:::

## Accessing secrets in your application

<SinceBadge version="2.8.0" />

Once Kuzzle has successfully loaded the file containing the secrets, it exposes its decrypted content to your application.

Secrets are accessible in the [app.vault.secrets](/core/2/framework/classes/backend-vault/properties) property.

## Accessing secrets in your plugin

Once Kuzzle has successfully loaded the file containing the secrets, it exposes its decrypted content to all plugins.

Secrets are accessible in the [secrets](/core/2/framework/classes/plugin-context/properties) property of the plugin context.
