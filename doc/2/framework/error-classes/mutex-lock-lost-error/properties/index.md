---
code: true
type: page
title: Properties | Framework | Core

description: MutexLockLostError class properties
---

# Properties

| Name      | Type              | Description                                                                                     |
| --------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| `cause`   | <pre>Error</pre>  | Why the lock was lost: the Redis error that made its extension fail, or else the lock library's own lost-lock error |
| `message` | <pre>string</pre> | Error message: `Lock lost for resource "<key>"`                                                 |
| `name`    | <pre>string</pre> | Error class name (`MutexLockLostError`)                                                         |
| `stack`   | <pre>string</pre> | Error stack trace                                                                               |
