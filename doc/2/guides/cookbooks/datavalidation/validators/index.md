---
code: false
type: page
title: Validators
description: learn how to create complex validators
order: 200
---

# The `validators` property

The `validators` property is an array of [Koncorde filters](/core/1/guides/cookbooks/realtime-api/#FIXME). Each filter has to match in order for the document to be valid.

## Structure

```json
{
  "myIndex": {
    "myCollection": {
      "strict": true,
      "fields": {
        "..."
      },
      "validators": [
        { "equals": { "fieldName": "maximilian"} },
        {
          "bool": {
            "must": [
              "..."
            ],
            "must_not": [
              "..."
            ],
            "should": [
              "..."
            ],
            "should_not": [
              "..."
            ]
          }
        },
        "..."
      ]
    },
    "..."
  },
  "..."
}
```

Translates to the following Koncorde query:

```json
{
  "bool": {
    "must": [
      { "equals": { "fieldName": "maximilian" } },
      {
        "bool": {
          "must": ["..."],
          "must_not": ["..."],
          "should": ["..."],
          "should_not": ["..."]
        }
      },
      "..."
    ]
  }
}
```
