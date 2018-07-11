#!/bin/bash

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
  tag=$2
  build_arg=$3

  print_something "Build image kuzzleio/$image:$tag from kuzzle-containers/$image/Dockerfile"

  docker build -t kuzzleio/$image:$tag -f kuzzle-containers/$image/Dockerfile --build-arg $build_arg kuzzle-containers/$image
}

docker_tag() {
  image=$1
  tag=$2

  print_something "Tag image kuzzleio/$image with $tag"

  docker tag kuzzleio/$image kuzzleio/$image:$tag
}

docker_push() {
  image=$1
  tag=$2

  print_something "Push image kuzzleio/$image:$tag to Dockerhub"

  docker push kuzzleio/$image:$tag
}

git_clone() {
  git clone --depth 1 https://github.com/kuzzleio/kuzzle-containers
  # cp ../kuzzle-containers .
  # use a test docker repository for now
  mv kuzzle-containers/kuzzle kuzzle-containers/kuzzle-test
}

if [ -z "$TRAVIS_BRANCH" ]; then
  echo "TRAVIS_BRANCH not found"
  exit 1
fi

if [ "$TRAVIS_BRANCH" == "1.x" ]; then
  git_clone

  tag="develop"

  docker_build 'plugin-dev' $tag kuzzle_branch=$TRAVIS_BRANCH
  docker_build 'kuzzle-test' $tag current_tag=$tag

  docker_push 'plugin-dev' $tag
  docker_push 'kuzzle-test' $tag

  rm -rf kuzzle-containers
elif [ "$TRAVIS_BRANCH" == "master" ]; then
  git_clone

  tag=$TRAVIS_TAG

  docker_build 'plugin-dev' $tag kuzzle_branch=$TRAVIS_BRANCH
  docker_build 'kuzzle-test' $tag current_tag=$tag

  docker_tag "plugin-dev:$tag" latest
  docker_tag "kuzzle-test:$tag" latest

  docker_push 'plugin-dev' $tag
  docker_push 'kuzzle-test' $tag

  docker_push 'plugin-dev' 'latest'
  docker_push 'kuzzle-test' 'latest'

  rm -rf kuzzle-containers
fi
