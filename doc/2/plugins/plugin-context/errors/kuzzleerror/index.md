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

| Property  | Type                | Description                                                                                                           |
| --------- | ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `message` | <pre>string</pre>   | Error message                                                                                                         |
| `stack`   | <pre>string[]</pre> | Error stack trace (not available in production mode)                                                                  |
| `status`  | <pre>integer</pre>  | Error status code, following the standard [HTTP status code](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes) 
| `errorName`  | <pre>string</pre>  | Error full name, composed by domain, subdomain and the name of the error |
| `domain`  | <pre>string</pre>  | Error domain (eg. `api`)|
| `subdomain`  | <pre>string</pre>  | Error subdomain, giving you more precision about the context (eg. `admin`) |
| `error`  | <pre>string</pre>  | Error defined name (eg. `database_not_found`)|
| `code`  | <pre>integer</pre>  | Error code |