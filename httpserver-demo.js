var http = require('http');
var url = require('url');
var fs = require('fs');
var path = require('path');

// http://localhost:2666/
var port = 2666;

// use corrent directory as base directory for all file serving
var basedir = process.cwd();

var server;

// naive getMIMEType implementation
function getMIMEType(filename) {
  var mimeTypes = {
    '.js': 'application/javascript',
    '.jpg': 'image/jpg',
    '.png': 'image/png',
    '.html': 'text/html'
  };

  // get the file extension
  var ext = path.extname(filename);

  if (ext in mimeTypes) {
    return mimeTypes[ext];
  }

  // if MIME type is not recognized, return the default above
  return 'text/plain';
}

// locate the filename for a specifc path
function getFilenameFromPath(filepath, callback) {
  // clean the filepath
  filepath = decodeURI(filepath.replace(/\+/g, '%20'));

  // normalize, transforming ./ and ../ etc in an absolute path
  var filename = path.normalize(basedir + path.sep + filepath);
// called when fs.stat() call is complete
  function onStatComplete(err, stats) {
    if (err) {
      return callback(err, filename);
    }

    if (stats.isDirectory()) {
      // if filename is a directory, look for index.html
      filename = path.normalize(filename + path.sep + 'index.html');
      fs.stat(filename, onStatComplete);
      return;
    }

    if (stats.isFile()) {
      // if filename is a file, return the name
      return callback(null, filename);
    } else {
      return callback(new Error("Unknown file type"), filename);
    }
  }

  // check if the file is still in the base directory for security reasons
  if (filename.substring(0, basedir.length) != basedir) {
    // if not, trigger 404
    var err = new Error("Not Found");
    err.code = 'ENOENT';
    return callback(err, filename);
  }

  // call to try to find the file
  fs.stat(filename, onStatComplete);
}

// this function gets called for each http request
function httpHandler(request, response) {
  // called after we extracted the filename
  function onGotFilename(err, filename) {
    // helper function that return errors as response if it occurs
    function writeError(err) {
      if (err.code == 'ENOENT') {
        // file not found
        response.writeHead(404, { 'Content-type': 'text/plain' });
        response.write('404 Not Found\n');
        response.end();
        console.log("Not Found: " + filename);
      } else {
        // other error
        response.writeHead(500, { 'Content-type': 'text/plain' });
        response.write('500 Internal Server Error\n');
        response.end();
        console.log("Internal Server Error: " + filename + ": " + err.code);
      }
    }

    if (err) {
      // in case of error, trigger 'writeError'
      writeError(err);
    } else {
      // no errors getting the filename, read the file
      fs.readFile(filename, "binary", function (err, file) {
        if (err) {
          // error reading the file
          writeError(err);
        } else {
          //no errors reading the file, proceed and get the MIME type
          var mimeType = getMIMEType(filename);
          response.writeHead(200, { "Content-type": mimeType });
          response.write(file, "binary");
          response.end();
          console.log("Sending file: " + filename);
        }
      });
    }
  }

  // extract the url parts that comes after host:port, wich wich is the part
  // that the browser is looking for
  var path = url.parse(request.url).pathname;

  getFilenameFromPath(path, onGotFilename);
}

function startHTTPServer() {
  server = http.createServer(httpHandler).listen(port);

  console.log("Listening on port " + port);

  return server;
}

exports.start = startHTTPServer;

if (require.main == module) {
  startHTTPServer();
}

