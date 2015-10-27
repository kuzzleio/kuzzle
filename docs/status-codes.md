# Status Codes and Error format

## Kuzzle response objects

A Kuzzle response is a JSON object with the following structure:
```javascript
{
  /*
  Integer containing the status code (HTTP-like: 200 if OK, 4xx or 5xx in case of error)
  */
  status: xxx,  

  /*
  Complex object containing error information, if something went wrong (null if OK)
  */
  error: {...},  

  /*
  Complex object, depending on your query
  */
  result: {...}
}
```

## Status codes

``status`` attribute is a numeric code similar to [HTTP status codes](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes).
It is used to inform the client about the real status of his request (if an error occured or not).

### List of status codes supported by Kuzzle

#### 2xx Success

* ``200``: standard status for a successful request.
* ``206``: the request (tipically a bulk import) is partially successful, but some actions encountered an error.
(in this case, details of errors are returned within _error.stack_)

#### 4xx Client Error

* ``400``: the request is misformed (usually: an argument is missing).
* ``403``: the client is not allowed to perform the requested action.
* ``404``: the requested resource cannot be found.

#### 5xx Server Error

* ``500``: Kuzzle encountered an unexpected error (standard code for internal error).
* ``503``: an external service is unavailable

## Error objects format

When an error occurred, the ``error`` object returned within the response has following JSON format:

A Kuzzle response is a JSON object with the following structure:
```javascript
{
  /*
  String containing the error message:
  */
  message: '...',

  /*
  Integer containing the occurrence number of the error (in case of multiple error for bulk actions)
  */
  count: 1,

  /*
  Complex object, with details of the error (kept empty for other than "500" errors)
  */
  stack: {...}
}
```

