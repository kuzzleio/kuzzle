#!/bin/bash

docker info /dev/null 2>&1 || (
    echo "installing docker"
    curl -sSL https://get.docker.com/ | sh
    systemctl enable docker

    echo "add vagrant user to docker group"
    usermod -aG docker vagrant

    grep "cgroup_enable=memory swapaccount=1" /etc/default/grub > /dev/null 2>&1 || (
        echo "giving docker swap and memory abilities"
        sed -ri 's|GRUB_CMDLINE_LINUX="(.*)"|GRUB_CMDLINE_LINUX="\1 cgroup_enable=memory swapaccount=1"|' /etc/default/grub
        update-grub
    )

    grep "EnvironmentFile" /lib/systemd/system/docker.service > /dev/null 2>&1 || (
        sed -ri "s|ExecStart=(.*)$|ExecStart=\1\nEnvironmentFile=-/etc/default/docker|" /lib/systemd/system/docker.service
        systemctl daemon-reload
    )
)

docker-compose --version > /dev/null 2>&1 || (
    echo "installing docker-compose"
    curl -sSL https://github.com/docker/compose/releases/download/1.3.1/docker-compose-`uname -s`-`uname -m` > /usr/local/bin/docker-compose
    chmod a+x /usr/local/bin/docker-compose
)

python --version > /dev/null 2>&1 || (
    echo "installing python"
    apt-get install python
)
