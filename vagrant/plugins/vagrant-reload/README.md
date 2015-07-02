# Vagrant Reload Provisioner

This is a Vagrant 1.2+ plugin that adds a `reload` provisioning step that can
be used to do a reload on a VM during provisioning.

# Installation

    $ vagrant plugin install vagrant-reload

## Usage

Add `config.vm.provision :reload` to your `Vagrantfile` to reload your VM
during provisioning.

## Development

To work on the `vagrant-reload` plugin, clone this repository out, and use
[Bundler](http://gembundler.com) to get the dependencies:

    $ bundle

You can test the plugin without installing it into your Vagrant environment by 
just creating a `Vagrantfile` in the top level of this directory 
(it is gitignored) and add the following line to your `Vagrantfile` 

```ruby
Vagrant.require_plugin "vagrant-reload"
```
Use bundler to execute Vagrant:

    $ bundle exec vagrant up

## Contributing

1. Fork it
2. Create your feature branch (`$ git checkout -b my-new-feature`)
3. Commit your changes (`$ git commit -am 'Add some feature'`)
4. Push to the branch (`$ git push origin my-new-feature`)
5. Create new Pull Request
