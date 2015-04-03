# Kuzzle development containers

## How to build & run

build: 

    $ ./build-all.sh

run:

    $ docker run -v src/path:/var/app -ti kuzzle

## What's in

**all**

* node.js
* pm2
* some common tools
* vim with some node.js plugins + theme
* a nice shell (zsh + oh-my-zsh)

**dev only**

* grunt + jslint
* node-inspector
  