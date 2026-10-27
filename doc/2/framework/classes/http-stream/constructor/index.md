---
code: true
type: page
title: constructor | Framework | Core

description: HttpStream class constructor() method
---

# constructor

Constructor method of the `HttpStream` class. It must be called with a [stream.Readable](https://nodejs.org/api/stream.html#class-streamreadable).

## Arguments

```ts
constructor (stream: stream.Readable, { totalBytes = -1 });
```

<br/>

| Argument | Type                                                                                                            | Description                                                                                                   |
| -------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `stream` | <pre>[stream.Readable](https://nodejs.org/api/stream.html#class-streamreadable)</pre> | [stream.Readable](https://nodejs.org/api/stream.html#class-streamreadable) instance |

<br/>

### Optionnal Arguments

| Argument     | Type                             | Description                                                                                   |
| ------------ | -------------------------------- | --------------------------------------------------------------------------------------------- |
| `totalBytes` | <pre>number</pre>(`-1`) | Represent the total number of bytes that the stream will send. `-1` means the size is dynamic |

## Usage

```ts
import { HttpStream } from 'kuzzle';
```

## Examples

See [HTTP Stream](/core/2/guides/develop-on-kuzzle/api-controllers#http-streams)

