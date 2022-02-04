---
code: false
type: page
title: Stream large volumes of data
description: Create streams to send large amount of data over the network
order: 300
---

# HTTP Streams <SinceBadge version="auto-version" />

Kuzzle sends response through HTTP using the JSON format.
[Kuzzle Response](/core/2/guides/main-concepts/api#response-format) are standardized. This format is shared by all API actions, including custom controller actions.

Kuzzle Response might be heavy when it comes to processing and sending large volumes of data, since the response are sent in one go,
this imply that all the processing must be done before sending the response and must be stored in ram until the whole response is sent.

To avoid having to process and store large amount of data before sending it, Kuzzle allow controller's actions to return an [HttpStream](/core/2/framework/classes/http-stream) instead
of a JSON object.
Kuzzle will then stream the data though the HTTP protocol in chunk until the stream is closed, this way you can process bits of your data at a time
and not have everything stored in ram.

## Usage

All you need to send a stream from any controller's actions is to wrap any [Readable Stream](https://nodejs.org/docs/latest-v14.x/api/stream.html#stream_class_stream_readable)
from NodeJS with an [HttpStream](/core/2/framework/classes/http-stream).

## Examples

Read a file from the disk and send it.
```js
const fs = require('fs');

async myAction (request) {
 const readStream = fs.createReadStream('./Document.zip');

 return new HttpStream(readStream);
}
```