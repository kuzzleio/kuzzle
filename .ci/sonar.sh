#!/bin/bash

set -e

export SONAR_SCANNER_VERSION=4.2.0.1873
export SONAR_SCANNER_HOME=$HOME/.sonar/sonar-scanner-$SONAR_SCANNER_VERSION-linux
rm -rf $SONAR_SCANNER_HOME
mkdir -p $SONAR_SCANNER_HOME
curl -sSLo $HOME/.sonar/sonar-scanner.zip https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-$SONAR_SCANNER_VERSION-linux.zip
unzip $HOME/.sonar/sonar-scanner.zip -d $HOME/.sonar/
rm $HOME/.sonar/sonar-scanner.zip
export PATH=$SONAR_SCANNER_HOME/bin:$PATH
export SONAR_SCANNER_OPTS="-server"

# Skip sonarqube analysis if not in a pull request
if [ "$TRAVIS_PULL_REQUEST" == "false" ]; then
  echo "=== Not a pull request: skipping sonar analysis"
  exit 0
fi

echo "=== Running sonar scanner"

# Unset travis pre-set parameters, which are more harmful than anything
unset SONARQUBE_SCANNER_PARAMS
unset SONARQUBE_SKIPPED
PACKAGE_VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[\",]//g' | tr -d '[[:space:]]')

sonar-scanner \
  -Dsonar.projectKey=kuzzleio_kuzzle \
  -Dsonar.projectVersion="$PACKAGE_VERSION" \
  -Dsonar.organization=kuzzleio \
  -Dsonar.sources=lib \
  -Dsonar.cfamily.build-wrapper-output=bw-output \
  -Dsonar.host.url=https://sonarcloud.io \
  -Dsonar.login="$SONARCLOUD_TOKEN" \
  -Dsonar.pullrequest.key="$TRAVIS_PULL_REQUEST" \
  -Dsonar.pullrequest.branch="$TRAVIS_PULL_REQUEST_BRANCH" \
  -Dsonar.pullrequest.base="$TRAVIS_BRANCH" \
  -Dsonar.pullrequest.provider="GitHub" \
  -X

  # -Dsonar.login="$SONARCLOUD_TOKEN" \
  # -Dsonar.language=js \
  # -Dsonar.pullrequest.github.repository="$TRAVIS_REPO_SLUG" \
  # -Dsonar.github.oauth="$SONAR_GITHUB_TOKEN" \
  # -Dsonar.github.repository="$TRAVIS_REPO_SLUG" \
  # -X
