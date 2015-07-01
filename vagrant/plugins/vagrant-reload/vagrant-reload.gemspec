# Add the lib directory to the load path so we can get the version file out.
$LOAD_PATH.unshift File.expand_path("../lib", __FILE__)

require 'vagrant-reload/version'

Gem::Specification.new do |gem|
  gem.name          = "vagrant-reload"
  gem.version       = VagrantPlugins::Reload::VERSION
  gem.platform      = Gem::Platform::RUBY
  gem.license       = "MIT"
  gem.authors       = "Aidan Nagorcka-Smith"
  gem.email         = "aidanns@gmail.com"
  gem.homepage      = "https://github.com/aidanns/vagrant-reload"
  gem.description   = "Enables reloading a vagrant VM as a provisioning step."
  gem.summary       = "Enables reloading a vagrant VM as a provisioning step."

  gem.add_development_dependency "rake"

  # The following block of code determines the files that should be included
  # in the gem. It does this by reading all the files in the directory where
  # this gemspec is, and parsing out the ignored files from the gitignore.
  # Note that the entire gitignore(5) syntax is not supported, specifically
  # the "!" syntax, but it should mostly work correctly.
  root_path      = File.dirname(__FILE__)
  all_files      = Dir.chdir(root_path) { Dir.glob("**/{*,.*}") }
  all_files.reject! { |file| [".", ".."].include?(File.basename(file)) }
  gitignore_path = File.join(root_path, ".gitignore")
  gitignore      = File.readlines(gitignore_path)
  gitignore.map!    { |line| line.chomp.strip }
  gitignore.reject! { |line| line.empty? || line =~ /^(#|!)/ }

  unignored_files = all_files.reject do |file|
    # Ignore any directories, the gemspec only cares about files
    next true if File.directory?(file)

    # Ignore any paths that match anything in the gitignore. We do
    # two tests here:
    #
    #   - First, test to see if the entire path matches the gitignore.
    #   - Second, match if the basename does, this makes it so that things
    #     like '.DS_Store' will match sub-directories too (same behavior
    #     as git).
    #
    gitignore.any? do |ignore|
      File.fnmatch(ignore, file, File::FNM_PATHNAME) ||
        File.fnmatch(ignore, File.basename(file), File::FNM_PATHNAME)
    end
  end

  gem.files         = unignored_files
  gem.executables   = unignored_files.map { |f| f[/^bin\/(.*)/, 1] }.compact
  gem.require_path  = 'lib'
end
