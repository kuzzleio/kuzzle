begin
  require "vagrant"
rescue LoadError
  raise "The Vagrant AWS plugin must be run within Vagrant."
end

# This is a sanity check to make sure no one is attempting to install
# this into an early Vagrant version.
if Vagrant::VERSION < "1.2.0"
  raise "The Vagrant Reload plugin is only compatible with Vagrant 1.2+"
end

module VagrantPlugins
  module Reload

    VERSION = "0.0.1"

    class Plugin < Vagrant.plugin("2")
      name "Reload"
      description <<-DESC
      The reload plugin allows a VM to be reloaded as a provisioning step.
      DESC
      
      provisioner "reload" do
        class ReloadProvisioner < Vagrant.plugin("2", :provisioner)

          def initialize(machine, config)
            super
          end

          def configure(root_config)
          end

          def provision
            options = {}
            options[:provision_ignore_sentinel] = false
            @machine.action(:reload, options)
            begin
              sleep 10
            end until @machine.communicate.ready?
          end

          def cleanup
          end

        end
        ReloadProvisioner

      end
    end
  end
end

