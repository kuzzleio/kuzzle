# kuzzleio/kuzzle:*-scratch

This image is meant to be used in production environment only.

It only contains Kuzzle code, Node.js and associated libraries.

## Usage

You should use this image as a base build your own application:

```dockerfile
# Build image
FROM node:12.18.1-alpine3.11 as builder

ADD . /your-plugin-name

WORKDIR /your-plugin-name

RUN  npm install --production

# Final image
FROM kuzzleio/kuzzle:2-scratch

COPY --from=builder /your-plugin-name /var/app/plugins/enabled/your-plugin-name
```

Then run `docker build -t your-plugin-name .`
