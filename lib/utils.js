"use babel";
import _s from 'underscore.string';

class VariableParser {

  lastLine = null;

  parse(data){
     let vars = [];
    let lines = data.split("\n");
    let len = lines.length;
    let line;
    let match;
    for (let i = 0; i < len; i++) {
      line = lines[i];
      if (match = line.match(/^(\w+)\s\=\s'(.*?)'\s*$/)) {
        //  console.log(match[1],'=>',match[2]);
        vars[match[1]] = match[2];
      }
    }
    this.lastLine = line;
    return vars;
  }

  getLastLine(){
    return this.lastLine;
  }
};

module.exports = {
  getRangeForQueryAtCursor: function (editor) {
    let queryEndRegex = /^.*\;$/;
    let currentCursorRow = editor.getCursorBufferPosition().row;
    let range = [[0], [editor.getLastBufferRow() + 1]];
    editor.scanInBufferRange(queryEndRegex, [[currentCursorRow], [editor.getLastBufferRow() + 1]],
      function (endMatch) {
        range[1] = [endMatch.range.start.row + 1];
        return endMatch.stop();
      });
    editor.backwardsScanInBufferRange(queryEndRegex, [[0], [currentCursorRow]],
      function (startMatch) {
        range[0] = [startMatch.range.start.row + 1];
        return startMatch.stop();
      });
    return range;
  },

  nullToEmpty(str) {
    return str ? str : '';
  },

  escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  },

  trimRight(str) {
    var tail = str.length;
    while (/[\s\uFEFF\u00A0]/.test(str[tail - 1])) {
      tail--;
    }
    return str.slice(0, tail);
  },


  isPidRunning(pid){
	  try {
		  return process.kill(pid,0)
	  }
	  catch (e) {
		  return e.code === 'EPERM';
	  }
  },


  createVariableParser(){
    return new VariableParser();
  },



  checkCommandReplyHasGset(checks) {
    if (!checks){
      return false;
    }
    for (let check of checks) {
      if (check == 'did-gset') {
        return true;
        break;
      }
    }
    return false;
  }


};


