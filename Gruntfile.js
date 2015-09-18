module.exports = function (grunt) {

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('gruntify-eslint');


  grunt.initConfig({
    jshint: {
      all: ['Gruntfile.js', 'test/**/*.js', 'features/**/*.js']
    },
    eslint: {
      src: ['lib/**/*.js']
    }
  });

  grunt.registerTask('default', ['jshint', 'eslint']);
};