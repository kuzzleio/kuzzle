---
code: true
type: page
title: mDelete
---

# mDelete

<SinceBadge version="auto-version"/>

Deletes multiple users.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/user/_mDelete[?refresh=wait_for]
Method: POST
Body:
```

```js
{
  "ids": ["kuid1", "kuid2", "..."]
}
```

### Other protocols

```js
{
  "controller": "user",
  "action": "mDelete",
  "body": {
    "ids": ["kuid1", "kuid2", "..."]
  }
}
```

---

## Arguments

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the deletions are indexed

---

## Body properties

- `ids`: an array of user [kuids](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid) to delete (default: `"wait_for"`)

---

## Response

Returns an array of successfully deleted users.

```js
{
  "status": 200,
  "error": null,
  "action": "mDelete",
  "controller": "user",
  "requestId": "<unique request identifier>",
  "result": [
    "kuid1",
    "kuid2",
    "..."
   ]
  }
}
```
