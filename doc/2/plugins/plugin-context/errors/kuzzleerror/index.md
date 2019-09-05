---
code: true
type: page
title: KuzzleError
order: 10
---

# KuzzleError



Inherits from the standard Javascript `Error` object: abstract class inherited by all Kuzzle error objects.

This class should only be used to create new Kuzzle error objects.

## Properties

| Property   | Type                | Description                                                                                                           |
| ---------- | ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `message`  | <pre>string</pre>   | Error message                                                                                                         |
| `stack`    | <pre>string</pre> | Error stack trace (not available in production mode)                                                                  |
| `status`   | <pre>number</pre>  | Error status code, following the standard [HTTP status code](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes) 
| `errorName`| <pre>string</pre>   | Error full name, composed by domain, subdomain and the name of the error |
| `code`     | <pre>number</pre>  | Error unique code |

### errorName

The `errorName` property is a concatenation of 3 levels of precision; explaining where an error comes from.
For instance, an `errorName` set to `plugins.foobar-plugins.some_error` belongs to the `plugins` domain. It has been thrown by a plugin named `foobar-plugin`, and the error itself has been attributed the name of `some_error`.
