---
code: true
type: page
title: mGetUsers
---

# mGetUsers



Gets multiple users.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/users/_mGet
Method: POST
Body:
```

```js
{
  "ids": ["user1", "user2"]
}
```

You can also access this route with the `GET` verb:

```http
URL: http://kuzzle:7512/users/_mGet?ids=user1,user2
Method: GET
```

### Other protocols

```js
{
  "controller": "security",
  "action": "mGetUsers",
  "body": {
    "ids": ["user1", "user2"]
  }
}
```

---

## Body properties

- `ids`: an array of user kuids to get

---

## Response

Returns a `hits` array of objects. Each object is a user object with the following properties:

- `_id`: user kuid
- `_source`: user content

```js
{
  "status": 200,
  "action": "mGetUsers",
  "controller": "security",
  "error": null,
  "requestId": "<unique request identifier>",
  "result": {
    "hits": [
      {
        "_id": "user1",
        "_source": {
          "profileIds": [
            "profile1"
          ]          
      },
      {
        "_id": "user2",
        "_source": {
          "profileIds": [
            "profile1",
            "profile2"
          ]
        }
      }
    ]
  }
}
```
