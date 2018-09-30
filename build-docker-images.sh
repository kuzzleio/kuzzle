#!/bin/bash

set -e

KUZZLE_LATEST_MAJOR=1

################################################################################
# Script used to build kuzzleio/plugin-dev and kuzzleio/kuzzle Docker images  ##
################################################################################

print_something() {
  something=$1

  echo ""
  echo "##############################################################"
  echo "#"
  echo "#      $something"
  echo "#"
  echo "##############################################################"
  echo ""
}

run_or_echo () {
  command=$1

  if [ "$MODE" == "production" ]; then
    $(command)
  else
    echo "$command"
  fi
}

docker_build() {
  image=$1
  kuzzle_tag=$2
  build_stage=$image

  print_something "Build image kuzzleio/$image:$kuzzle_tag with stage $build_stage of Dockerfile"

  run_or_echo "docker build --target $build_stage -t kuzzleio/$image:$kuzzle_tag ."
}

docker_tag() {
  image=$1
  from_tag=$2
  to_tag=$3

  print_something "Tag image kuzzleio/$image:$from_tag to kuzzleio/$image:$to_tag"

  run_or_echo "docker tag kuzzleio/$image:$from_tag kuzzleio/$image:$to_tag"
}

docker_push() {
  image=$1
  tag=$2

  print_something "Push image kuzzleio/$image:$tag to Dockerhub"


  run_or_echo "docker push kuzzleio/$image:$tag"
}


if [ "$MODE" == "production" ] && [ -z "$DOCKER_PASSWORD" ]; then
  echo "Unable to find DOCKER_PASSWORD for account kuzzleteam"
  exit 1
fi
run_or_echo "docker login -u kuzzleteam -p $DOCKER_PASSWORD"

if [[ "$TRAVIS_BRANCH" == *"-dev" ]]; then
  # Build triggered by a merge on branch *-dev
  # Images are built in Travis

  docker_build 'plugin-dev' "$TRAVIS_BRANCH"
  docker_build 'kuzzle' "$TRAVIS_BRANCH"

  docker_push 'plugin-dev' "$TRAVIS_BRANCH"
  docker_push 'kuzzle' "$TRAVIS_BRANCH"

  # Keep develop tag for now
  # If this is a release of the current major version
  # we can push with the 'develop' tag
  if [ "$TRAVIS_BRANCH" == "$KUZZLE_LATEST_MAJOR-dev" ]; then
    docker_tag 'plugin-dev' "$TRAVIS_BRANCH" 'develop'
    docker_tag 'kuzzle' "$TRAVIS_BRANCH" 'develop'

    docker_push 'plugin-dev' 'develop'
    docker_push 'kuzzle' 'develop'
  fi
elif [ ! -z "$RELEASE_TAG" ]; then
  # Build triggered by a new release
  # The build is triggered by Github webhook
  # Images are built in Travis

  docker_build 'plugin-dev' "$RELEASE_TAG"
  docker_build 'kuzzle' "$RELEASE_TAG"

  docker_push 'plugin-dev' "$RELEASE_TAG"
  docker_push 'kuzzle' "$RELEASE_TAG"

  # If this is a release of the current major version
  # we can push with the 'latest' tag
  if [[ "$RELEASE_TAG" == "$KUZZLE_LATEST_MAJOR."* ]]; then
    docker_tag 'plugin-dev' "$RELEASE_TAG" 'latest'
    docker_tag 'kuzzle' "$RELEASE_TAG" 'latest'

    docker_push 'plugin-dev' 'latest'
    docker_push 'kuzzle' 'latest'
  fi

fi
