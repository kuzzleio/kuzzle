ARG NODE_TAG=10-stretch-slim

FROM node:${NODE_TAG} AS dependencies

ARG CLUSTER_BRANCH=3/fix-js-injection
ARG KONCORDE_BRANCH=fix-js-injection
ARG KUZZLE_VERSION=1.11.0
ARG SSH_KEY

ENV GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=no"
ENV NODE_ENV=production

WORKDIR /var/app
COPY . /var/app

RUN  set -x \
  \
  && mkdir -p /root/.ssh \
  && echo "${SSH_KEY}" > /root/.ssh/id_rsa \
  && chmod 0600 /root/.ssh/id_rsa \
  \
  && apt-get update \
  && apt-get install -y \
    build-essential \
    gdb \
    git \
    jq \
    python \
    libfontconfig \
    libkrb5-dev \
    libzmq3-dev \
    openssh-client \
  \
  && npm i -g npm \
  && npm set progress=false \
  && npm config set unsafe-perm true \
  \
  && echo "Patch version" \
  && jq ' .version="'${KUZZLE_VERSION}'" ' package.json > package.json.tmp && mv package.json.tmp package.json \
  && jq ' .version="'${KUZZLE_VERSION}'" ' npm-shrinkwrap.json > npm-shrinkwrap.json.tmp && mv npm-shrinkwrap.json.tmp npm-shrinkwrap.json \
  \
  && echo "Replace koncorde with last commit from security branch" \
  && npm uninstall koncorde \
  && repo=git@github.com:kuzzleio/koncorde-security-patch.git \
  && sha1=$(git ls-remote ${repo} refs/heads/${KONCORDE_BRANCH} | awk '{ print $1 }') \
  && npm i git://${repo}#${sha1} \
  \
  && npm ci \
  && for plugin in plugins/available/*/; do  \
      npm ci --prefix $plugin; \
     done

# main image
# -----------------------------------------------------------------------------
FROM node:${NODE_TAG}

WORKDIR /var/app

ENV NODE_ENV=production

COPY --from=dependencies /var/app/ /var/app/

RUN  ln -s /var/app/docker/scripts/run.sh /usr/local/bin/kuzzle \
  && chmod a+x /usr/local/bin/kuzzle \
  && chmod a+x /var/app/docker/scripts/docker-entrypoint.sh

ENTRYPOINT ["/var/app/docker/scripts/docker-entrypoint.sh"]

CMD ["kuzzle", "start"]

