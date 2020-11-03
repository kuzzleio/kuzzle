---
code: false
type: page
title: Subscribe to Realtime Notifications
description: Use the Realtime Engine to subscribe to database change
order: 500
---

# Subscribe to Realtime Notifications

Kuzzle integrates an **advanced realtime engine**. It can work in a classic pub/sub mode but also as a realtime database notification engine.

**Any change occuring on the database can generate a realtime notification** about the creation, modification and deletion of documents.

A filter system also allows clients to receive notifications only according to their interest in certain types of documents.

Subscription to realtime notifications is **performed client-side and does not require additional server-side code.**

### Subscribe to changes

First, we need to subscribe to changes occuring in a specific collection:

```bash
kourou realtime:subscribe nyc-open-data yellow-taxi
```

::: info
This will use the [realtime:subscribe](/core/2/api/controllers/realtime/subscribe) API action. 
::: 

Kourou is now waiting for realtime notifications about changes in our collection.

We are going to create a new document in the Admin Console to trigger one!

Open the [Admin Console](http://next-console.kuzzle.io/#/data/nyc-open-data/yellow-taxi) and then create a new document. 

Then you should receive a notification about the created document in your terminal:

```bash
 🚀 Kourou - Subscribes to realtime notifications
 
 [ℹ] Connecting to ws://localhost:7512 ...
 [ℹ] Waiting for realtime notifications on "nyc-open-data":"yellow-taxi" ...

 [ℹ] New notification triggered by API action "document:create"
 {
  "_id": "dvIdJ3UB1MqPtuLKxKDS",
  "_source": {
    "name": "Aschen",
    "city": "Antalya",
    "age": 27,
    "_kuzzle_info": {
      "author": "-1",
      "createdAt": 1602679063751,
      "updatedAt": null,
      "updater": null
    }
  },
  "_version": 1
}
```

### Use subscription filters

Kuzzle allows you to **use filters** to receive only the notifications **matching specific types of documents**.  

Again, we are going to subscribe to notifications but only for documents where:
  - `age` is greater than `30`
  - `city` is equal to `Antalya`

This filter must be written using [Koncorde Filter DSL](/core/2/some-link), which is a little inspired by Elasticsearch DSL:

::: info
Koncorde is part of the Kuzzle Realtime Engine and handles subscription filters.
:::

```json
{
  "and": [
    {
      "range": {
        "age": { "gt": 30 }
      },
    },
    {
      "equals": {
        "city": "Antalya"
      }
    }
  ]
}
```

Now we can subscribe again with our filter:

```bash
kourou realtime:subscribe nyc-open-data yellow-taxi '{
  and: [
    {
      range: {
        age: { gt: 30 }
      }
    },
    {
      equals: {
        city: "Antalya"
      }
    }
  ]
}'
```

Then we create 10 documents using the [`sdk:execute` command in Kourou](https://github.com/kuzzleio/kourou#kourou-sdkexecute):

```bash
kourou sdk:execute --code '
  for (let i = 1; i <= 10; i++) {
    await sdk.document.create("nyc-open-data", "yellow-taxi", {
      name: `Yagmur-${i}`,
      city: i % 2 ? "Antalya" : "Istanbul",
      age: 27 + i
    });
  }'
```

::: info
Kourou is able to [execute](/core/2/api/kourou/commands/sdk/execute) Javascript code snippets.  
A `sdk` variable is exposed and refers to an instance of the [Javascript SDK](/sdk/js/7), connected to Kuzzle and authenticated if credentials are provided.
::: 


<details><summary>You should receive only the following 3 notifications (that correspond with the filters specified in the subscription):</summary>

```bash
 🚀 Kourou - Subscribes to realtime notifications
 
 [ℹ] Connecting to ws://localhost:7512 ...
 [ℹ] Waiting for realtime notifications on "nyc-open-data":"yellow-taxi" ...
 [ℹ] New notification triggered by API action "document:create"
 {
  "_id": "hfI3J3UB1MqPtuLKwaCh",
  "_source": {
    "name": "Yagmur-5",
    "city": "Antalya",
    "age": 32,
    "_kuzzle_info": {
      "author": "-1",
      "createdAt": 1602680766880,
      "updatedAt": null,
      "updater": null
    }
  },
  "_version": 1
}
 [ℹ] New notification triggered by API action "document:create"
 {
  "_id": "h_I3J3UB1MqPtuLKwaDE",
  "_source": {
    "name": "Yagmur-7",
    "city": "Antalya",
    "age": 34,
    "_kuzzle_info": {
      "author": "-1",
      "createdAt": 1602680766915,
      "updatedAt": null,
      "updater": null
    }
  },
  "_version": 1
}
 [ℹ] New notification triggered by API action "document:create"
 {
  "_id": "ifI3J3UB1MqPtuLKwaDn",
  "_source": {
    "name": "Yagmur-9",
    "city": "Antalya",
    "age": 36,
    "_kuzzle_info": {
      "author": "-1",
      "createdAt": 1602680766950,
      "updatedAt": null,
      "updater": null
    }
  },
  "_version": 1
}
```

</details>

::: info
Going further:
 - [Koncorde Filter DSL](/core/2/some-link)
 - [Realtime Engine](/core/2/guides/main-concepts/5-realtime-engine)
 - Javascript SDK [realtime.subscribe](/sdk/js/7/controllers/realtime/subscribe) method
:::

<GuidesLinks 
  :prev="{ text: 'Authenticate Users', url: '/core/2/guides/getting-started/4-authenticate-users/' }" 
  :next="{ text: 'Create new Controllers', url: '/core/2/guides/getting-started/6-write-application/' }" 
/>
