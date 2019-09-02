---
code: true
type: page
title: decryptSecrets
---

# decryptSecrets

<SinceBadge version="1.10.0" />

Decrypts an object using [Vault](/core/2/guides/essentials/secrets-vault/).

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/admin/_decryptSecrets
Method: POST
Body:
```

```js
{
  "vaultKey": "your_vault_key",
  "secrets": {
    "aws": {
      "key": "a32d94368111ca329958e921a4fe5d70.36d6b839bcfee696b76b62c4de655cd0"
    }
  }
}
```


### Other protocols


```js
{
  "controller": "admin",
  "action": "decryptSecrets",
  "body": {
    "vaultKey": "your_vault_key",
    "secrets": {
      "aws": {
        "key": "a32d94368111ca329958e921a4fe5d70.36d6b839bcfee696b76b62c4de655cd0"
      }
    }
  }
}
```

## Body properties

- `vaultKey`: the vault key used to decrypt your secrets
- `secrets`: Object which represents the secrets to decrypt

---

## Response

Returns an object with decrypted values.

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
        "key": "silmaril"
      }
    } 
  }
}
```
