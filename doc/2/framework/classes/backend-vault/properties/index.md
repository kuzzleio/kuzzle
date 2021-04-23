---
code: false
type: page
title: Properties
description: BackendVault class properties
---

# BackendVault

<SinceBadge version="2.8.0" />
<CustomBadge type="error" text="Experimental: non-backward compatible changes or removal may occur in any future release."/>

The `BackendVault` class handles the secrets vault.  

It is accessible from the [Backend.config](/core/2/framework/classes/backend/properties#config) property.

See the [Secrets Vault](/core/2/guides/advanced/secrets-vault) guide.

## `key`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>string</pre> | Secret key to decrypt encrypted values | set |

::: info
This property is only available before the application is started.
:::

## `file`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>string</pre> | Path to the file containing encrypted secrets | set |

::: info
This property is only available before the application is started.
:::

## `secrets`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>JSONObject</pre> | Decrypted secrets | get       |
