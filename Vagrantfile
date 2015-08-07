# -*- mode: ruby -*-
# vi: set ft=ruby :

# Plugin from Aidan Nagorcka-Smith
# https://github.com/aidanns/vagrant-reload
require './vagrant/plugins/vagrant-reload/lib/vagrant-reload'

# YAML library for settings file loading
require 'yaml'

# add recursive_merge function to merge YAML files
class Hash
    def recursive_merge(h)
        self.merge!(h) {|key, _old, _new| if _old.class == Hash then _old.recursive_merge(_new) else _new end  }
    end
end

# Load Vagrant config from YML file :
vagrantConfig = YAML::load_file( "vagrant.yml" )
if File.file?('.vagrant/vagrant.yml')
  # Override default vagrant file by locally settings :
  vagrantConfig.recursive_merge(YAML::load_file( ".vagrant/vagrant.yml" ))
end


# Vagrantfile API/syntax version. Don't touch unless you know what you're doing!
VAGRANTFILE_API_VERSION = "2"

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|

  config.vm.box = vagrantConfig['virtualmachine']['box']
  config.vm.hostname = vagrantConfig['virtualmachine']['hostname']

  private_network_ip = vagrantConfig['virtualmachine']['network']['private_network_ip']
  if private_network_ip.nil?
    action = ""
  else
    config.vm.network "private_network", ip: private_network_ip
  end

  forwarded_port = vagrantConfig['virtualmachine']['network']['forwarded_port']
  if forwarded_port.nil?
    action = ""
  elsif forwarded_port.respond_to?("each")
    forwarded_port.each do |key, value|
      config.vm.network "forwarded_port", guest: key,  host: value
    end
  else
    config.vm.network "forwarded_port", guest: forwarded_port.key,  host: forwarded_port.value
  end


  synced_folder = vagrantConfig['virtualmachine']['synced_folder']
  if synced_folder.nil?
    action = ""
  elsif synced_folder.respond_to?("each")
    synced_folder.each do |item|
      config.vm.synced_folder item, "/home/vagrant/" + item
    end
  else
      config.vm.synced_folder synced_folder, "/home/vagrant/" + synced_folder
  end

  config.vm.provider "virtualbox" do |v|
    v.memory = vagrantConfig['virtualmachine']['ram']
  end

  config.vm.provision "shell", path: "vagrant/setup.sh", privileged: true
  config.vm.provision :reload
  config.vm.provision "shell", path: "vagrant/kuzzle.sh", run: "always", privileged: true
end
