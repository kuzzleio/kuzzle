# -*- mode: ruby -*-
# vi: set ft=ruby :

# Plugin from Aidan Nagorcka-Smith
# https://github.com/aidanns/vagrant-reload
require './vagrant/plugins/vagrant-reload/lib/vagrant-reload'

# Vagrantfile API/syntax version. Don't touch unless you know what you're doing!
VAGRANTFILE_API_VERSION = "2"

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|
  config.vm.box = "debian/jessie64"

  config.vm.network "forwarded_port", guest: 8081, host: 8081
  config.vm.network "forwarded_port", guest: 1883, host: 1883
  config.vm.network "forwarded_port", guest: 5672, host: 5672
  config.vm.network "forwarded_port", guest: 15672, host: 15672
  config.vm.network "forwarded_port", guest: 61613, host: 61613

  config.vm.provider "virtualbox" do |v|
    v.memory = 1024
  end

  config.vm.provision "ansible" do |ansible|
    ansible.playbook = "vagrant/docker.yml"
  end
  config.vm.provision :reload

  config.vm.provision "ansible", run: "always" do |ansible|
    ansible.playbook = "vagrant/kuzzle.yml"
  end
end
