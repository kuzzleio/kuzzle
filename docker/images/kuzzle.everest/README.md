# kuzzleio/kuzzle:*-everest

This image is meant to be used in production environment only.

It only contains Kuzzle code, Node.js and associated libraries.

The system and Kuzzle code are compressed inside the image to reduce the total size.  

Decompression is done in the entrypoint and take approximatively ~4s.

## Usage

You should use this image as a base build your own application:

```dockerfile
# Build image
FROM node:12.16.3-alpine3.11 as builder

ADD . /your-plugin-name

WORKDIR /your-plugin-name

RUN  npm install --production

# Final image
FROM kuzzleio/kuzzle:2-everest

COPY --from=builder /your-plugin-name /var/app/plugins/enabled/your-plugin-name
```

Then run `docker build -t your-plugin-name .`