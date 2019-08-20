---
code: true
type: page
title: errors manager
---

## Errors Manager

When creating your own Kuzzle plugin, you can use the errors manager to have customizable errors.

In order to define it, you have to write them inside the [manifest.json](https://docs.kuzzle.io/core/1/plugins/guides/manual-setup/prerequisites/#manifest-json) in a `errors` field.

Your manifest will be something like :
```
{
    "name": "kuzzle-plugin-xxx",
    "kuzzleVersion": ">=1.0.0 <2.0.0",
    "privileged": false,
    "errors": {
        "some_error": {
            "code": 1,
            "message": "Some error occurred: %s",
            "class": "BadRequestError"
	},
        "some_other_error": {
            "code": 2,
            "message": "Some other error occurred: %s",
            "class": "ForbiddenError"
	}
    }
}
```

It is exposed as `errorsManager` in the [PluginContext].
(https://docs.kuzzle.io/core/1/plugins/plugin-context/accessors/intro/).
To access its function, you would write:
To throw : `context.errorsManager.throw(errorName, placeholders);`.
To get the built error: `context.errorsManager.getError(errorName, placeholders);`

# Example

If you customize errors like above and you write `context.errorsManager.throw('some_error', 'Something get wrong');`, Kuzzle will throw a BadRequestError with the following properties :

- message : `Some error occured: Something get wrong`
- errorName : `plugins.kuzzle-plugin-xxx.some_error`
- domain : `plugins`
- subdomain : `kuzzle-plugin-xxx`
- error : `some_error`
- code : 1