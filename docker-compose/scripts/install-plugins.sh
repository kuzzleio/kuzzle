WORKING_DIR=$(pwd)
PLUGINS_DIR=plugins/enabled

# npm install plugins
for plugin in $WORKING_DIR/$PLUGINS_DIR/*
do
  if [ -d $plugin ]
  then
    echo 'Installing dependencies for plugin' $(basename $plugin)
    cd $plugin
    npm install
  fi
done

cd $WORKING_DIR
