#!/bin/bash

set -e

PACKAGE_VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[\",]//g' | tr -d '[[:space:]]')

echo "=== Running sonar scanner"

# Unset travis pre-set parameters, which are more harmful than anything
unset SONARQUBE_SCANNER_PARAMS
unset SONARQUBE_SKIPPED

if [ "$TRAVIS_PULL_REQUEST" != "false" ]; then
	sonar-scanner \
		-Dsonar.host.url=https://sonarqube.kaliop.net \
		-Dsonar.projectKey=kuzzle:server \
		-Dsonar.sources=lib \
		-Dsonar.projectVersion="$PACKAGE_VERSION" \
		-Dsonar.login="$SONAR_TOKEN" \
		-Dsonar.language=js \
		-Dsonar.github.pullRequest="$TRAVIS_PULL_REQUEST" \
		-Dsonar.github.oauth="$SONAR_GITHUB_TOKEN" \
		-Dsonar.github.repository="$TRAVIS_REPO_SLUG" \
		-X
else
	sonar-scanner \
		-Dsonar.host.url=https://sonarqube.kaliop.net \
		-Dsonar.projectKey=kuzzle:server \
		-Dsonar.sources=lib \
		-Dsonar.projectVersion="$PACKAGE_VERSION" \
		-Dsonar.login="$SONAR_TOKEN" \
		-Dsonar.language=js \
		-Dsonar.github.oauth="$SONAR_GITHUB_TOKEN" \
		-Dsonar.github.repository="$TRAVIS_REPO_SLUG" \
		-X
fi
