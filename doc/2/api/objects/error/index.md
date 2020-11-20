---
code: false
type: page
title: Error
description: Error payload reference  
order: 400
---

# Error

Errors returned by the Kuzzle API in the `error` part of a response are objects with the following properties:

| Property     | Type               | Description                                            |
| ------------ | ------------------ | ------------------------------------------------------ |
| `status`     | <pre>number</pre>  | HTTP status code                                       |
| `message`    | <pre>string</pre>  | Short description of the error                         |
| `stack`      | <pre>string</pre>  | Error stack trace (Available in development mode only) |
| `id`         | <pre>string</pre>  | Error unique identifier |
| `code`       | <pre>number</pre>  | Error unique code |


### id

The `id` property is unique to each type of error that can be returned, and is built by concatenating the following information:

* Domain: from where the error comes from (API, network, plugin, ...)
* Subdomain: what kind of error it is (assertion, runtime, ...)
* Error: the error itself

For instance:
* `api.assert.missing_argument` is an assertion error triggered by the API because of a missing argument
* `network.http.url_not_found` is a HTTP error triggered by the network layer, because a requested URL couldn't be found


The complete list of API errors is available [here](/core/2/api/errors/2-error-codes/).

---

### code

The `code` property is a 32-bits integer representation of the unique `id` error identifier, detailed above.

It's meant to be used by low-level languages to efficiently catch specific error codes and act on them.

Code format:
- Domain: ranges from `00` to `FF` (1 byte)
- Subdomain: ranges from `00` to `FF` (1 byte)
- Error: ranges from `0000` to `FFFF` (2 bytes)


The complete list of API errors is available [here](/core/2/api/errors/2-error-codes/).
