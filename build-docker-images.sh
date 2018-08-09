#!/bin/bash

################################################################################
# Script used to build kuzzleio/plugin-dev and kuzzleio/kuzzle Docker images  ##
################################################################################

print_something() {
  something=$1

  echo "##############################################################"
  echo ""
  echo $something
  echo ""
  echo "##############################################################"
}

docker_build() {
  image=$1
  kuzzle_tag=$2
  build_stage=$3

  print_something "Build image kuzzleio/$image:$kuzzle_tag with stage $build_stage of Dockerfile"

  # The $build_stage variable will be removed when this script will be production-ready (push kuzzleio/kuzzle instead of kuzzleio/kuzzle8)
  docker build --target $build_stage -t kuzzleio/$image:$kuzzle_tag  --build-arg kuzzle_tag=$kuzzle_tag .
}

docker_tag() {
  image=$1
  from_tag=$2
  to_tag=$3

  print_something "Tag image kuzzleio/$image:$from_tag to kuzzleio/$image:$to_tag"

  docker tag kuzzleio/$image:$from_tag kuzzleio/$image:$to_tag
}

docker_push() {
  image=$1
  tag=$2

  print_something "Push image kuzzleio/$image:$tag to Dockerhub"

  docker push kuzzleio/$image:$tag
}


if [ -z "$DOCKER_PASSWORD" ]; then
  echo "Unable to find DOCKER_PASSWORD for account kuzzleteam"
  exit 1
fi
docker login -u kuzzleteam -p $DOCKER_PASSWORD

if [ "$TRAVIS_BRANCH" == "1.x" ]; then
  # Build triggered by a merge on branch 1.x
  # Images are built in Travis

  docker_build 'plugin-dev' "$TRAVIS_BRANCH" 'plugin-dev'
  docker_build 'kuzzle8' "$TRAVIS_BRANCH" 'kuzzle'

  docker_push 'plugin-dev' "$TRAVIS_BRANCH"
  docker_push 'kuzzle8' "$TRAVIS_BRANCH"

  # Keep develop tag for now
  docker_tag 'plugin-dev' "$TRAVIS_BRANCH" 'develop'
  docker_tag 'kuzzle8' "$TRAVIS_BRANCH" 'develop'

  docker_push 'plugin-dev' 'develop'
  docker_push 'kuzzle8' 'develop'
elif [ "$TRAVIS_BRANCH" == "2.x" ]; then
  # Build triggered by a merge on branch 2.x
  # Images are built in Travis

  docker_build 'plugin-dev' "$TRAVIS_BRANCH" 'plugin-dev'
  docker_build 'kuzzle8' "$TRAVIS_BRANCH" 'kuzzle'

  docker_push 'plugin-dev' "$TRAVIS_BRANCH"
  docker_push 'kuzzle8' "$TRAVIS_BRANCH"
elif [ ! -z "$RELEASE_TAG" ]; then
  # Build triggered by a new release
  # The build is triggered by Github webhook
  # Images are built in Travis

  docker_build 'plugin-dev' "$RELEASE_TAG" 'plugin-dev'
  docker_build 'kuzzle8' "$RELEASE_TAG" 'kuzzle'

  docker_tag 'plugin-dev' "$RELEASE_TAG" 'latest'
  docker_tag 'kuzzle8' "$RELEASE_TAG" 'latest'

  docker_push 'plugin-dev' "$RELEASE_TAG"
  docker_push 'kuzzle8' "$RELEASE_TAG"

  docker_push 'plugin-dev' 'latest'
  docker_push 'kuzzle8' 'latest'
fi
