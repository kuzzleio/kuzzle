---
code: true
type: page
title: secrets
---

# secrets

<SinceBadge version="1.8.0" />

Secrets contained in the [Vault](/core/2/guides/essentials/secrets-vault) and loaded at Kuzzle startup.

They have the same format as in the JSON file:

```js
/* config/secrets.enc.json */
{
  "aws": {
    "keyId": "a47de7426fbcb8904290e376f147bc73.8e4b35be62ecbc53"
  }
}
```

```js
init (config, context) {
  console.log(context.secrets);
  // {
  //   aws: {
  //     keyId: 'decrypted aws key id'
  //   }
  // }
}
```
