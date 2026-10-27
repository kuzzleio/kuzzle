---
code: true
type: page
title: Properties | Framework | Core

description: KuzzleError abstract class properties
---

# Properties

| Name              | Type          | Description |
|-------------------|---------------|-------------|
| `code`         | <pre>number</pre> | Error unique code |
| `id`           | <pre>string</pre> | Error unique name |
| `name`         | <pre>string</pre> | Name of the error class (e.g. `NotFoundError`) |
| `message`      | <pre>string</pre> | Error message  |
| `props`        | <pre>string[]</pre> | Placeholders substituted into the message when the error was built from an [error code](/core/2/api/errors/error-codes), `undefined` otherwise |
| `stack`        | <pre>string</pre> | Error stack trace |
| `status`       | <pre>number</pre> | Error status code (Kuzzle's API errors follow the HTTP standard) |
