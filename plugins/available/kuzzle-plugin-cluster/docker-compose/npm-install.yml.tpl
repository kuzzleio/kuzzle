version: '3'

services:
  kuzzle:
    build: ./images/kuzzle
    volumes:
      ${KUZ_VOLUME}
      - "..:/var/app/plugins/enabled/cluster"
    command: |
      bash -c '
        rm -rf ./node_modules
        npm install --unsafe-perm
        echo
        echo "plugins"
        rm -rf ./plugins/enabled/*/node_modules
        for p in /var/app/plugins/enabled/*/; do echo ${DOLLAR}${DOLLAR}p; done
        for plugin in /var/app/plugins/enabled/*/ ; do
          echo "${DOLLAR}${DOLLAR}plugin"
          cd "${DOLLAR}${DOLLAR}plugin"
          npm install --unsafe-perm
          cd /var/app
        done
        echo
        echo "protocols"
        rm -rf protocols/enabled/*/node_modules
        for protocol in protocols/enabled/*/; do
          cd "${DOLLAR}${DOLLAR}protocol"
          npm install --unsafe-perm
          cd /var/app
        done
      '
    environment:
      NODE_ENV: development


