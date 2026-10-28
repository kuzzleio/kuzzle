---
code: true
type: page
title: Properties | Framework | Core

description: MultipleErrorsError class properties
---

# Properties

| Name              | Type          | Description |
|-------------------|---------------|-------------|
| `code`         | <pre>number</pre> | Error unique code |
| `count`        | <pre>number</pre> | Number of errors in `errors` |
| `errors`       | <pre>Array&lt;KuzzleError&gt;</pre> | List of the gathered errors |
| `id`           | <pre>string</pre> | Error unique name |
| `name`         | <pre>string</pre> | Error class name (`MultipleErrorsError`) |
| `message`      | <pre>string</pre> | Error message  |
| `stack`        | <pre>string</pre> | Error stack trace |
| `status`       | <pre>number</pre> | Error status code (`400`) |

When serialized, the `errors` are serialized too.
