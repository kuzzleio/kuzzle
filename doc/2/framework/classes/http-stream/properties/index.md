---
code: false
type: page
title: Properties | Framework | Core

description: HttpStream class properties
---

<SinceBadge version="2.17.0" />

# Properties

## `stream`

This property is an instance of the [stream.Readable](https://nodejs.org/api/stream.html#class-streamreadable) class from NodeJS.

| Type                                                                         | Description                |
|------------------------------------------------------------------------------|----------------------------|
| <pre>[stream.Readable](https://nodejs.org/api/stream.html#class-streamreadable)</pre> | Readable Stream instance |


## `totalBytes`

| Type              | Description                       |
|-------------------|-----------------------------------|
| <pre>number</pre>(`-1`) | Total number of bytes to send. `-1` means the size is dynamic |

## `destroyed`

| Type               | Get / Set | Description                                       |
|--------------------|-----------|---------------------------------------------------|
| <pre>boolean</pre> | get       | `true` if the stream has been destroyed |

## `errored`

| Type               | Get / Set | Description                                       |
|--------------------|-----------|---------------------------------------------------|
| <pre>boolean</pre> | get       | `true` if the stream has been destroyed with an error |

## `error`

| Type             | Get / Set | Description                                            |
|------------------|-----------|--------------------------------------------------------|
| <pre>Error</pre> | get       | Error the stream has been destroyed with, if any       |
