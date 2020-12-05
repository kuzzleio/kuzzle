---
code: false
type: page
title: Properties
description: RequestInput class properties
---

# RequestInput

API request arguments are accessible here.

Common arguments are accessible at the root level:
_`jwt`, `volatile`, `body`, `controller`, `action`_

Resource arguments are accessible under the `resource` property:
_`_id`, `index`, `collection`_

Every other arguments are accessible under the `args` property. E.g:
_`refresh`, `onExistingUser`, `foobar`, etc._

## `action`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>string</pre> | API action name | get |

## `args`


| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>JSONObject</pre> | KuzzleRequest arguments (except `body`, `_id`, `index` and `collection`) | get |

## `body`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>JSONObject</pre> | KuzzleRequest body | get |

## `controller`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>string</pre> | API controller name | get |

## `headers`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>JSONObject</pre> | KuzzleRequest headers (Http only) | get |

## `jwt`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>string</pre> | Authentication token | get |

## `resource`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>JSONObject</pre> | Class containing Kuzzle specific arguments | get |

### Specific arguments

| name |Type                  | Description       | get / set |
|------|-----------------|-------------------|-----------|
| `resource._id` | <pre>string</pre> | Document ID | get |
| `resource.index` | <pre>string</pre> | Index name | get |
| `resource.collection` | <pre>string</pre> | Collection name | get |

## `volatile`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>string</pre> | API action name | get |
