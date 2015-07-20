#global module:false

"use strict"

module.exports = (grunt) ->
  grunt.loadNpmTasks "grunt-bower-task"
  grunt.loadNpmTasks "grunt-contrib-connect"
  grunt.loadNpmTasks "grunt-contrib-copy"
  grunt.loadNpmTasks "grunt-contrib-clean"
  grunt.loadNpmTasks "grunt-contrib-watch"

  grunt.initConfig
    copy:
      jquery:
        files: [{
          expand: true
          cwd: "bower_components/jquery/dist/"
          src: "jquery.min.js"
          dest: "vendor/js/"
        }]
      moment:
        files: [{
          expand: true
          cwd: "bower_components/moment/min/"
          src: "moment.min.js"
          dest: "vendor/js/"
        }]
      jquery_ui:
        files: [{
          expand: true
          cwd: "bower_components/jquery-ui/"
          src: ['themes/redmond/**']
          dest: "vendor/css/"
        },
        {
          expand: true
          cwd: "bower_components/jquery-ui/"
          src: "jquery-ui.min.js"
          dest: "vendor/js/"
        }]
      jquery_ui_slider_pips:
        files: [{
          expand: true
          cwd: "bower_components/jquery-ui-slider-pips/dist/"
          src: "jquery-ui-slider-pips.css"
          dest: "vendor/css/"
        },
        {
          expand: true
          cwd: "bower_components/jquery-ui-slider-pips/dist/"
          src: "jquery-ui-slider-pips.min.js"
          dest: "vendor/js/"
        }]
      jquery_blockUI:
        files: [{
          expand: true
          cwd: "bower_components/blockUI/"
          src: "jquery.blockUI.js"
          dest: "vendor/js/"
        }]
      font_awesome:
        files: [{
          expand: true
          cwd: "bower_components/font-awesome/css/"
          src: "font-awesome.min.css"
          dest: "vendor/css/"
        }]
      bootstrap:
        files: [{
          expand: true
          cwd: "bower_components/bootstrap/dist/css/"
          src: "bootstrap.min.css"
          dest: "vendor/css/"
        },
        {
          expand: true
          cwd: "bower_components/bootstrap/dist/js/"
          src: "bootstrap.min.js"
          dest: "vendor/js/"
        }]
      bootstrap_switch:
        files: [{
          expand: true
          cwd: "bower_components/bootstrap-switch/dist/css/bootstrap3/"
          src: "bootstrap-switch.min.css"
          dest: "vendor/css/"
        },
        {
          expand: true
          cwd: "bower_components/bootstrap-switch/dist/js/"
          src: "bootstrap-switch.min.js"
          dest: "vendor/js/"
        }]
      fullcalendar:
        files: [{
          expand: true
          cwd: "bower_components/fullcalendar/dist/"
          src: "fullcalendar.min.css"
          dest: "vendor/css/"
        },
        {
          expand: true
          cwd: "bower_components/fullcalendar/dist/"
          src: "fullcalendar.min.js"
          dest: "vendor/js/"
        },
        {
          expand: true
          cwd: "bower_components/fullcalendar/dist/"
          src: "gcal.js"
          dest: "vendor/js/"
        }]
      cryptojs:
        files: [{
          expand: true
          cwd: "bower_components/cryptojslib/rollups/"
          src: "md5.js"
          dest: "vendor/js/"
        }]
      vendor:
        files: [{
          expand: true,
          src: ['vendor/**'],
          dest: '_site/'
        }]

    clean:
      vendor: [
        "vendor",
        "_site/vendor"
      ]

    watch:
      options:
        livereload: true
      source:
        files: [
          "assets/**/*"
          "*.html"
        ]

    connect:
      server:
        options:
          port: 4000
          base: '.'
          livereload: true

  grunt.registerTask "build", [
    "clean"
    "copy"
  ]

  grunt.registerTask "serve", [
    "build"
    "connect:server"
    "watch"
  ]

  grunt.registerTask "default", [
    "serve"
  ]