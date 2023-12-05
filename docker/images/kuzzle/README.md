# kuzzleio/kuzzle

This image is meant to be used in production environment.

This image is based on `bitnami/minideb:stretch` and it contains Kuzzle code and dependencies.

## Usage

You should use this image as a base build your own application:

```dockerfile
# Build image
FROM node:18 as builder

ADD . /your-plugin-name

WORKDIR /your-plugin-name

RUN  npm ci --production

# Final image
FROM kuzzleio/kuzzle:2

COPY --from=builder /your-plugin-name /var/app/plugins/enabled/your-plugin-name
```

Then run `docker build -t your-plugin-name .`