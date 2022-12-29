---
code: true
type: page
title: mexecute | API | Core
---

# mexecute



Allows the execution of multiple commands or 'actions' in a single step.

It creates a redis **transaction** block and **executes** it immediately, all actions will be executed sequentially and as a single atomic and isolated operation.

[[_Redis documentation_]](https://redis.io/topics/transactions)

::: warning
Only already supported actions can be executed using **mexecute**.
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_mexecute
Method: POST
Body:
```

```js
{
  "actions": [
    {"action": "command", "args": {"_id": "x", "body": {"value": 1}},
    {"action": "command", "args": {"_id": "x"}},
    {"action": "...", "args": {...}}
  ]
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "mexecute",
  "body": {
    "actions": [
        {"action": "command", "args": {"_id": "x", "body": {"value": 1}},
        {"action": "command", "args": {"_id": "x"}},
        {"action": "...", "args": {...}}
    ]
  }
}
```

---

## Body properties

- `actions`: an array of objects. Each object describes an action to be executed, using the following properties:
  - `action`: action name
  - `args`: an object containing all required arguments

---

## Response

Returns an array of error & result pairs for each executed action, in order.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "mexecute",
  "collection": null,
  "index": null,
  "result": [
      ["err" | null, "result"],
      [null, "OK"],
      [null, 1],
  ]
}
```
