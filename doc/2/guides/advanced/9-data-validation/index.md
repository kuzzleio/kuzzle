---
code: false
type: page
title: Data Validation
description: Ensure data quality rules
order: 900
---

# Data Validation

One common requirement when you are managing data is to perform **data validation**. In real world applications you may need to check that any newly created or updated document meet a certain criteria.

A common example is **email validation**. Let's say you have developed a registration page where you request a user's name and email and you want to ensure that the email they provide is valid.

With Kuzzle, instead of programming the validation logic yourself, you can pick from a set of predefined [validation patterns](/core/2/guides/advanced/9-data-validation). Validations are defined in a validation schema which determines what pattern is linked to what field, every time Kuzzle receives input data, it checks this validation schema and returns an error if a validation pattern fails. The validation schema can be configured in the `validation` field of the [configuration file](/core/2/guides/advanced/8-configuration).

For a detailed look at data validation, please refer to our [Data Validation Reference](/core/2/guides/advanced/9-data-validation).

::: info
You can bypass data validation by using [bulk:write](/core/2/api/controllers/bulk/write) or [bulk:mWrite](/core/2/api/controllers/bulk/m-write) actions.
:::

---

## Basic Validation

A validation schema is defined using a [hierarchical](/core/2/guides/advanced/9-data-validation) structure that contains a set of rules within an index, collection, and document field.

For example, below is a validation schema for the `onlineshop` index and `products` collection that defines the validation pattern for field `price` and field `productDescription`:

```json
{
  "validation": {
    "onlineshop": {
      "products": {
        "fields": {
          "price": {
            "type": "number",
            "mandatory": true
          },
          "productDescription": {
            "type": "string",
            "defaultValue": "Sorry, no description available for this product."
          }
        }
      }
    }
  }
}
```

Let's take a look at what this validation schema does:

- It defines a set of rules for documents in the `products` collection of the `onlineshop` index.
- It ensures that `price` exists and is a `Number`.
- It ensures that `productDescription` is a `String` and has a value when none is provided.

For a complete list of validation patterns please refer to our [Validation Patterns Reference](/core/2/guides/advanced/9-data-validation).

---

## Type Options

Type Options can be used to provide advanced validation of certain fields. These are only available for some field types.

Below is an example of how the `range` type option is used to ensure that the field `price` is greater than zero:

```json
{
  "validation": {
    "onlineshop": {
      "products": {
        "fields": {
          "price": {
            "type": "number",
            "mandatory": true,
            "typeOptions": {
              "range": {
                "min": 0
              }
            }
          },
          "productDescription": {
            "type": "string",
            "defaultValue": "Sorry, no description available for this product."
          }
        }
      }
    }
  }
}
```

For more information regarding Type Options, please refer to [this](/core/2/guides/advanced/9-data-validation) section of the Data Validation Reference.

---

## Advanced Validation

If the basic validation functionality doesn't meet your requirements, you can take advantage of [Koncorde](/core/2/api/koncorde-filters-syntax) to create complex validation specifications.

:::info
Koncorde is the same component used to create real-time subscriptions.
:::

The idea is simple: use Koncorde to specify a filter that can be used to validate documents. For example, here we ensure that at least one of the fields `price` or `vatPrice` exists by placing a filter in the `validators` field of the validation schema:

```json
{
  "validation": {
    "onlineshop": {
      "products": {
        "fields": {
          "price": {
            "type": "number",
            "typeOptions": {
              "range": {
                "min": 0
              }
            }
          },
          "vatPrice": {
            "type": "number",
            "typeOptions": {
              "range": {
                "min": 0
              }
            }
          },
          "productDescription": {
            "type": "string",
            "defaultValue": "Sorry, no description available for this product."
          }
        },
        "validators": [
          // Here goes the filters
          {
            "or": [
              {
                "exists": {
                  "field": "price"
                }
              },
              {
                "exists": {
                  "field": "vatPrice"
                }
              }
            ]
          }
        ]
      }
    }
  }
}
```

In the example above, we used both the `exists` operator and the `or` operator to build our validation rule. For more information take a look at our [Koncorde Reference](/core/2/api/koncorde-filters-syntax/clauses#exists).
