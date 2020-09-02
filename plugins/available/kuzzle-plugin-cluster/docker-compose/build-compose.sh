if [ ! -f ./my.env ]; then
    echo "Edit my.env and run me again"
    exit 1
fi

# main
. ./my.env

export DOLLAR='$'
export NODE_ENV=${NODE_ENV:-development}

# kuzzle
export KUZ_VOLUME=""
if [ "$KUZ_PATH" != "" ]; then
    export KUZ_VOLUME="- \"$(readlink -f ${KUZ_PATH}):/var/app\""
fi

envsubst < docker-compose.yml.tpl > docker-compose.yml
