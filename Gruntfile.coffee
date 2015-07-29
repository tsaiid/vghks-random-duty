#global module:false

"use strict"

module.exports = (grunt) ->
  grunt.loadNpmTasks "grunt-bower-task"
  grunt.loadNpmTasks "grunt-contrib-connect"
  grunt.loadNpmTasks "grunt-contrib-watch"
  grunt.loadNpmTasks "grunt-sync"

  opts = {
    base_path: '_site/vghks-random-duty',
    js_path: '_site/vghks-random-duty/vendor/js/',
    css_path: '_site/vghks-random-duty/vendor/css/',
    font_path: '_site/vghks-random-duty/vendor/fonts/',
  }

  grunt.initConfig
    opts: opts,
    sync: {
      main: {
        files: [
          { src: ['assets/**', 'index.html', 'VERSION'], dest: '<%= opts.base_path %>'},
          { cwd: 'bower_components/jquery/dist/', src: 'jquery.min.*', dest: '<%= opts.js_path %>' },
          { cwd: 'bower_components/moment/min/', src: 'moment.min.js', dest: '<%= opts.js_path %>' },
          { cwd: 'bower_components/jquery-ui/', src: ['themes/redmond/**'], dest: '<%= opts.css_path %>' },
          { cwd: 'bower_components/jquery-ui/', src: 'jquery-ui.min.js', dest: '<%= opts.js_path %>' },
          { cwd: 'bower_components/jquery-ui-slider-pips/dist/', src: 'jquery-ui-slider-pips.css', dest: '<%= opts.css_path %>' },
          { cwd: 'bower_components/jquery-ui-slider-pips/dist/', src: 'jquery-ui-slider-pips.min.js', dest: '<%= opts.js_path %>' },
          { cwd: 'bower_components/blockUI/', src: 'jquery.blockUI.js', dest: '<%= opts.js_path %>' },
          { cwd: 'bower_components/font-awesome/css/', src: 'font-awesome.min.css', dest: '<%= opts.css_path %>' },
          { cwd: 'bower_components/font-awesome/fonts/', src: ['*.woff*', '*.ttf', '*.eot'], dest: '<%= opts.font_path %>' },
          { cwd: 'bower_components/bootstrap/dist/css/', src: 'bootstrap.min.css', dest: '<%= opts.css_path %>' },
          { cwd: 'bower_components/bootstrap/dist/js/', src: 'bootstrap.min.js', dest: '<%= opts.js_path %>' },
          { cwd: 'bower_components/bootstrap-switch/dist/css/bootstrap3/', src: 'bootstrap-switch.min.css', dest: '<%= opts.css_path %>' },
          { cwd: 'bower_components/bootstrap-switch/dist/js/', src: 'bootstrap-switch.min.js', dest: '<%= opts.js_path %>' },
          { cwd: 'bower_components/bootstrap-dialog/dist/css/', src: 'bootstrap-dialog.min.css', dest: '<%= opts.css_path %>' },
          { cwd: 'bower_components/bootstrap-dialog/dist/js/', src: 'bootstrap-dialog.min.js', dest: '<%= opts.js_path %>' },
          { cwd: 'bower_components/fullcalendar/dist/', src: 'fullcalendar.min.css', dest: '<%= opts.css_path %>' },
          { cwd: 'bower_components/fullcalendar/dist/', src: 'fullcalendar.min.js', dest: '<%= opts.js_path %>' },
          { cwd: 'bower_components/fullcalendar/dist/', src: 'gcal.js', dest: '<%= opts.js_path %>' },
          { cwd: 'bower_components/cryptojslib/rollups/', src: 'md5.js', dest: '<%= opts.js_path %>' },
          { cwd: 'bower_components/excellentexport/', src: 'excellentexport.min.js', dest: '<%= opts.js_path %>' },
          { cwd: 'bower_components/jquery.contenteditable/', src: 'jquery.contenteditable.js', dest: '<%= opts.js_path %>' },
        ],
        verbose: true,
        pretend: false, # Don't do any disk operations - just write log
        ignoreInDest: "**/.git/**", # Never remove js files from destination
        updateAndDelete: true # Remove all files from dest that are not found in src
      }
    }

    watch:
      options:
        livereload: true
      source:
        files: [
          "assets/**/*"
          "*.html"
        ]
        tasks: [
          "sync"
        ]

    connect:
      server:
        options:
          port: 4000
          base: '<%= opts.base_path %>'
          livereload: true

  grunt.registerTask "build", [
    "sync"
  ]

  grunt.registerTask "serve", [
    "build"
    "connect:server"
    "watch"
  ]

  grunt.registerTask "default", [
    "serve"
  ]