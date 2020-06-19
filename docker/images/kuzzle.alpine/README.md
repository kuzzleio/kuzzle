# kuzzleio/kuzzle:*-alpine

This image is meant to be used in production environment only.

This image is based on `node:12.16.3-alpine3.11` and it contains Kuzzle code and dependencies.

## Usage

You should use this image as a base build your own application:

```dockerfile
# Build image
FROM node:12.16.3-alpine3.11 as builder

ADD . /your-plugin-name

WORKDIR /your-plugin-name

RUN  npm install --production

# Final image
FROM kuzzleio/kuzzle:2-alpine

COPY --from=builder /your-plugin-name /var/app/plugins/enabled/your-plugin-name
```

Then run `docker build -t your-plugin-name .`