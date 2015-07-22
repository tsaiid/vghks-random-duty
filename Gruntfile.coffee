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
      vendor:
        # jquery
        files: [{
          expand: true
          cwd: "bower_components/jquery/dist/"
          src: "jquery.min.js"
          dest: "_site/vendor/js/"
        },
        # moment
        {
          expand: true
          cwd: "bower_components/moment/min/"
          src: "moment.min.js"
          dest: "_site/vendor/js/"
        },
        #jquery_ui
        {
          expand: true
          cwd: "bower_components/jquery-ui/"
          src: ['themes/redmond/**']
          dest: "_site/vendor/css/"
        },
        {
          expand: true
          cwd: "bower_components/jquery-ui/"
          src: "jquery-ui.min.js"
          dest: "_site/vendor/js/"
        },
        # jquery_ui_slider_pips
        {
          expand: true
          cwd: "bower_components/jquery-ui-slider-pips/dist/"
          src: "jquery-ui-slider-pips.css"
          dest: "_site/vendor/css/"
        },
        {
          expand: true
          cwd: "bower_components/jquery-ui-slider-pips/dist/"
          src: "jquery-ui-slider-pips.min.js"
          dest: "_site/vendor/js/"
        },
        # jquery_blockUI
        {
          expand: true
          cwd: "bower_components/blockUI/"
          src: "jquery.blockUI.js"
          dest: "_site/vendor/js/"
        },
        # font_awesome
        {
          expand: true
          cwd: "bower_components/font-awesome/css/"
          src: "font-awesome.min.css"
          dest: "_site/vendor/css/"
        },
        {
          expand: true
          cwd: "bower_components/font-awesome/fonts/"
          src: ['*.woff*', '*.ttf']
          dest: "_site/vendor/fonts/"
        },
        # bootstrap
        {
          expand: true
          cwd: "bower_components/bootstrap/dist/css/"
          src: "bootstrap.min.css"
          dest: "_site/vendor/css/"
        },
        {
          expand: true
          cwd: "bower_components/bootstrap/dist/js/"
          src: "bootstrap.min.js"
          dest: "_site/vendor/js/"
        },
        # bootstrap_switch
        {
          expand: true
          cwd: "bower_components/bootstrap-switch/dist/css/bootstrap3/"
          src: "bootstrap-switch.min.css"
          dest: "_site/vendor/css/"
        },
        {
          expand: true
          cwd: "bower_components/bootstrap-switch/dist/js/"
          src: "bootstrap-switch.min.js"
          dest: "_site/vendor/js/"
        },
        # bootstrap_dialog
        {
          expand: true
          cwd: "bower_components/bootstrap-dialog/dist/css/"
          src: "bootstrap-dialog.min.css"
          dest: "_site/vendor/css/"
        },
        {
          expand: true
          cwd: "bower_components/bootstrap-dialog/dist/js/"
          src: "bootstrap-dialog.min.js"
          dest: "_site/vendor/js/"
        },
        # fullcalendar
        {
          expand: true
          cwd: "bower_components/fullcalendar/dist/"
          src: "fullcalendar.min.css"
          dest: "_site/vendor/css/"
        },
        {
          expand: true
          cwd: "bower_components/fullcalendar/dist/"
          src: "fullcalendar.min.js"
          dest: "_site/vendor/js/"
        },
        {
          expand: true
          cwd: "bower_components/fullcalendar/dist/"
          src: "gcal.js"
          dest: "_site/vendor/js/"
        },
        # cryptojs
        {
          expand: true
          cwd: "bower_components/cryptojslib/rollups/"
          src: "md5.js"
          dest: "_site/vendor/js/"
        },
        # Excellent Export
        {
          expand: true
          cwd: "bower_components/excellentexport/"
          src: "excellentexport.min.js"
          dest: "_site/vendor/js/"
        }]
      sources:
        files: [{
            expand: true,
            src: ['assets/**', 'index.html'],
            dest: '_site/'
          }]

    clean:
      vendor: ["_site/vendor"]
      sources: ['_site/assets/**', '_site/index.html']

    watch:
      options:
        livereload: true
      source:
        files: [
          "assets/**/*"
          "*.html"
        ]
        tasks: [
          "copy:sources"
        ]

    connect:
      server:
        options:
          port: 4000
          base: '_site'
          livereload: true

  grunt.registerTask "build", [
    "clean"
    "copy"
  ]

  grunt.registerTask "serve", [
    "copy"
    "connect:server"
    "watch"
  ]

  grunt.registerTask "default", [
    "serve"
  ]