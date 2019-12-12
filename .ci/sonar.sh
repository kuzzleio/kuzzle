#!/bin/bash

set -e

# Skip sonarqube analysis if not in a pull request
if [ "$TRAVIS_PULL_REQUEST" == "false" ]; then
  echo "=== Not a pull request: skipping sonar analysis"
  exit 0
fi

export SONAR_SCANNER_VERSION=4.2.0.1873
export SONAR_SCANNER_HOME=$HOME/.sonar/sonar-scanner-$SONAR_SCANNER_VERSION-linux
rm -rf $SONAR_SCANNER_HOME
mkdir -p $SONAR_SCANNER_HOME
curl -sSLo $HOME/.sonar/sonar-scanner.zip https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-$SONAR_SCANNER_VERSION-linux.zip
unzip $HOME/.sonar/sonar-scanner.zip -d $HOME/.sonar/
rm $HOME/.sonar/sonar-scanner.zip
export PATH=$SONAR_SCANNER_HOME/bin:$PATH
export SONAR_SCANNER_OPTS="-server"


echo "=== Running sonar scanner"

PACKAGE_VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[\",]//g' | tr -d '[[:space:]]')

sonar-scanner \
  -Dsonar.projectKey=kuzzleio_kuzzle \
  -Dsonar.projectVersion="$PACKAGE_VERSION" \
  -Dsonar.organization=kuzzleio \
  -Dsonar.sources=lib \
  -Dsonar.language=js \
  -Dsonar.cfamily.build-wrapper-output=bw-output \
  -Dsonar.host.url=https://sonarcloud.io \
  -Dsonar.login="$SONARCLOUD_TOKEN" \
  -Dsonar.pullrequest.key="$TRAVIS_PULL_REQUEST" \
  -Dsonar.pullrequest.branch="$TRAVIS_PULL_REQUEST_BRANCH" \
  -Dsonar.pullrequest.base="$TRAVIS_BRANCH" \
  -Dsonar.pullrequest.provider="GitHub" \
  -Dsonar.pullrequest.github.repository="$TRAVIS_REPO_SLUG" \
  -X
