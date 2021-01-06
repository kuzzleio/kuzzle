---
code: true
type: page
title: Properties
description: PartialError class properties
---

# Properties

| Name              | Type          | Description |
|-------------------|---------------|-------------|
| `code`         | <pre>number</pre> | Error unique code |
| `id`           | <pre>string</pre> | Error unique name |
| `name`         | <pre>string</pre> | Error class name (`PartialError`) |
| `message`      | <pre>string</pre> | Error message  |
| `stack`        | <pre>string</pre> | Error stack trace |
| `status`       | <pre>number</pre> | Error status code (`206`) |
| `errors`       | <pre>Array&lt;KuzzleError&gt;</pre> | List of errors encountered when executing the action |
