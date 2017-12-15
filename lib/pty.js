/** @babel */
/** @jsx etch.dom */

import {spawn as spawnNodePty} from 'node-pty';
// import child_pty from 'child_pty';
// import streamBuffers from 'stream-buffers';


class PtyChildPty {

  constructor(child) {
    this.child = child;
    this.pid = child.pid;
    let self = this;
    let stream = new streamBuffers.WritableStreamBuffer();
    this.stream = stream;
    this.child.stdout.pipe(stream);
    this.intervalId = setInterval(() => {
      let data = stream.getContentsAsString('utf8');
      if (data) {
        self.onData(data);
      }
    });
    console.log(this.intervalId);
  }

  write(data) {
    this.child.stdin.write(data);
  }


  kill() {
    clearInterval(this.intervalId);
    this.child.kill();
    if (this.onExit) {
       this.onExit();
    }
  }

  on(event, callback) {
    if (event == 'data') {
      this.onData = callback;
    } else if (event == 'exit') {
      this.onExit = callback;
    } else {
      console.log('childPTY REGISTER UNKNOWN EVENT: ', event);
    }
  }

  resize(cols, rows) {
    console.log('pty resize');
    this.child.stdout.resize({columns: cols, rows: rows});
  }

}


function _spawnChildPty(CMD, ARGS, options) {
  let child = child_pty.spawn(CMD, ARGS, options);
  console.log(child);
  return new PtyChildPty(child);
}


//////////////////////////////////////////////////////////////////////
class PtyNodePty {

  constructor(pty) {
    this.pty = pty;
    this.pid = pty.pid;
  }

  write(data) {
    this.pty.write(data);
  }


  kill() {
    console.log("pty.kill");
    this.pty.kill();
  }

  on(event, callback) {
    this.pty.on(event, callback);
  }

  resize(cols, rows) {
    this.pty.resize(cols, rows);
  }

}

function _spawnNodePty(CMD, ARGS, options) {
  let pty = spawnNodePty(CMD, ARGS, options);
  return new PtyNodePty(pty);
}

/////////////////////////////////////////////////////////////////////////


function spawnPty(CMD, ARGS, options) {
  return _spawnNodePty(CMD,ARGS,options);
  //return _spawnChildPty(CMD, ARGS, options);
}

export {
  spawnPty
}




