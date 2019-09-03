---
code: true
type: page
title: encryptSecrets
---

# encryptSecrets

<SinceBadge version="1.10.0" />

Encrypts an object using [Vault](/core/1/guides/essentials/secrets-vault/).

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/admin/_encryptSecrets
Method: POST
Body:
```

```js
{
  "vaultKey": "your_vault_key",
  "secrets": {
    "aws": {
      "key": "myKey"
    }
  }
}
```


### Other protocols


```js
{
  "controller": "admin",
  "action": "encryptSecrets",
  "body": {
    "vaultKey": "your_vault_key",
    "secrets": {
      "aws": {
        "key": "myKey"
      }
    }
  }
}
```

## Body properties

- `vaultKey`: the vault key used to encrypt your secrets
- `secrets`: Object which represents the secrets to encrypt

---

## Response

Returns an object with encrypted values.

```js
{
  "requestId": "d16d5e8c-464a-4589-938f-fd84f46080b9",
  "status": 200,
  "error": null,
  "controller": "admin",
  "action": "encryptSecrets",
  "collection": null,
  "index": null,
  "result": { 
    "secrets": {
      "aws": {
        "key": "a32d94368111ca329958e921a4fe5d70.36d6b839bcfee696b76b62c4de655cd0"
      }
    } 
  }
}
```
