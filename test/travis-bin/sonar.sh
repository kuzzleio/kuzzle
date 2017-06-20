#!/bin/bash

set -e

PACKAGE_VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[\",]//g' | tr -d '[[:space:]]')

if [ "${TRAVIS_PULL_REQUEST}" != "false" ]
then
  echo "=== Running sonar scanner"

  # Unset travis pre-set parameters, which are more harmful than anything
  unset SONARQUBE_SCANNER_PARAMS
  unset SONARQUBE_SKIPPED

  sonar-scanner \
    -Dsonar.host.url=https://sonarqube.kaliop.net \
    -Dsonar.projectKey=kuzzle:server \
    -Dsonar.sources=lib \
    -Dsonar.analysis.mode=preview \
    -Dsonar.projectVersion="$PACKAGE_VERSION" \
    -Dsonar.login="$SONAR_TOKEN" \
    -Dsonar.language=js \
    -Dsonar.github.pullRequest="$TRAVIS_PULL_REQUEST" \
    -Dsonar.github.oauth="$SONAR_GITHUB_TOKEN" \
    -Dsonar.github.repository="$TRAVIS_REPO_SLUG"
fi

