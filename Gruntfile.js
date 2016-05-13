module.exports = function (grunt) {

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('gruntify-eslint');


  grunt.initConfig({
    jshint: {
      all: ['Gruntfile.js', 'test/**/*.js', 'features/**/*.js'],
      options: {
        jshintrc: './.jshintrc'
      }
    },
    eslint: {
      src: ['lib/**/*.js', 'bin/**/*.js']
    }
  });

  grunt.registerTask('default', ['jshint', 'eslint']);
};