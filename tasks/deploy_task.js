'use strict';

module.exports = function(grunt) {

  grunt.registerMultiTask('deploy', 'Your task description goes here.', function () {
    var self = this;
    var done = self.async();
    var Connection = require('ssh2');
    var moment = require('moment');
    var timeStamp = moment().format('YYYYMMDDHHmmssSSS');

    var options = self.options();
    var connections = [];

    var execSingleServer = function (server, connection) {

      var exec = function (cmd, showLog, next) {
        console.log(server.username + "@" + server.host + ":~$ " + cmd);
        connection.exec(cmd, function (err, stream) {
          if (err) {
            throw err;
          }
          stream.on('data', function (data, extended) {
            showLog && console.log(data + '');
          });
          stream.on('end', function () {
            next && next();
          });
        });
      };

      var execCmds = function (cmds, index, showLog, next) {
        if (!cmds || cmds.length <= index) {
          next && next();
        }
        else {
          exec(cmds[index++], showLog, function () {
            execCmds(cmds, index, showLog, next);
          })
        }
      }

      console.log('executing cmds before deploy22');
      execCmds(options.cmds_before_deploy, 0, true, function () {
        console.log('cmds before deploy executed');


        var createFolder = 'cd ' + options.deploy_path + '/releases && mkdir ' + timeStamp;
        var removeCurrent = 'rm -rf ' + options.deploy_path + '/current';
        var setCurrent = 'ln -s ' + options.deploy_path + '/releases/' + timeStamp + ' ' + options.deploy_path + '/current';

        console.log('start deploy');
        exec(createFolder + ' && ' + removeCurrent + ' && ' + setCurrent, true, function () {

          var sys = require('sys')
          var execLocal = require('child_process').exec;
          var child;

          console.log("Starting upload");
          var cmdCopy = "scp -r " + (options.source_path || ".") + " " + server.username + "@" + server.host + ":" + options.deploy_path + "/releases/" + timeStamp;
          console.log(cmdCopy);
          child = execLocal(cmdCopy, function (error, stdout, stderr) {
            if (error)
              return console.error(error);
            console.log('end deploy');

            console.log('executing cmds after deploy');
            execCmds(options.cmds_after_deploy, 0, true, function () {
              console.log('cmds after deploy executed');
              connection.end();
            });
          });
        })
      })
    }

    var length = options.servers.length;
    var completed = 0;
    var checkCompleted = function () {
      completed++;
      if (completed >= length) {
        done();
      }
    }

    options.servers.forEach(function (server) {
      var c = new Connection();
      c.on('connect', function () {
        console.log('Connecting to server: ' + server.host);
      });
      c.on('ready', function () {
        console.log('Connected to server: ' + server.host);
        execSingleServer(server, c);
      });
      c.on('error', function (err) {
        console.log("Error on server: " + server.host)
        console.error(err);
        if (err) {
          throw err;
        }
      });
      c.on('close', function (had_error) {
        console.log("Closed connection for server: " + server.host);
        checkCompleted();
      });
      c.connect(server);
    })
  });
};