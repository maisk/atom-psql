/** @babel */
/** @jsx etch.dom */

import {CompositeDisposable} from 'atom';
import ResizeObserver from 'resize-observer-polyfill';
import Terminal from 'xterm';
import etch from 'etch';
import path from 'path';
import {spawnPty} from "./pty";
import Utils from './utils';
//import {DB_VIEW_URI} from './db-view';

Terminal.loadAddon('fit');

const CHAR_DATA_ATTR_INDEX = 0;
const CHAR_DATA_CHAR_INDEX = 1;
const CHAR_DATA_WIDTH_INDEX = 2;
const CHAR_DATA_CODE_INDEX = 3;

export class TerminalView {

  URI = null;
  ARGS = [];
  ENV = {};
  CMD = null;
  onKey = null;
  onPaste = null;
  onExit = null;
  terminalEchoON = true;
  ptyDataRecordFlag = false;

  constructor({uri, args, env, cmd, onKey, onPaste, onExit}) {
    this.URI = uri;
    this.ARGS = args;
    this.ENV = env;
    this.CMD = cmd;
    this.disposables = new CompositeDisposable();
    this.onKey = onKey;
    this.onPaste = onPaste;
    this.onExit = onExit;
    this.ptyRunninFlag = false;

    etch.initialize(this);
    this._openTerminal();
    this._handleEvents();
    this.ptyData = '';
    this.ptyDataRecordFlag = false;
    this.terminalEchoON = true;

    let regexp_prompt1_str = atom.config.get('atom-psql.psql.psqlPrompt1Regexp');
    let regexp_prompt2_str = atom.config.get('atom-psql.psql.psqlPrompt2Regexp');
    this.regexp_prompt1 = new RegExp(regexp_prompt1_str);
    this.regexp_prompt2 = new RegExp(regexp_prompt2_str);

    this.now = new Date().getTime();
    //console.log("NEW PSQLTERMINAL",this.now);

    this.disposables.add(atom.commands.add('psql-terminal-view', {
      'psql-terminal-view:copy': () => {
        let activeTerminalView = atom.workspace.getActivePaneItem();
        activeTerminalView.copySelection();
      },
      'psql-terminal-view:paste': () => {
        let activeTerminalView = atom.workspace.getActivePaneItem();
        activeTerminalView.pasteFromClipboard();
      },

      'psql-terminal-view:send_slash_x': () => {
        let cmd = "\\x\n";
        let activeTerminalView = atom.workspace.getActivePaneItem();
        if (activeTerminalView.isReadyForCommand()) {
        } else {
          activeTerminalView.sendBrake();
          setTimeout(()=>{
            activeTerminalView.writeToPty(cmd);
          },500);
        }
      },

      // 'atom-psql:terminal-clear':()=>{
      //   let activeTerminalView = atom.workspace.getActivePaneItem();
      //   activeTerminalView.clear();
      // },
      //this.handleClear.bind(this)
    }));

    atom.contextMenu.add({
      'psql-terminal-view': [{
        label: 'copy',
        command: 'psql-terminal-view:copy'
      }, {
        label: 'paste',
        command: 'psql-terminal-view:paste'
      },
        {
          label: '\\x',
          command: 'psql-terminal-view:send_slash_x',
        }

        //   {
        //   label: 'psql: \\d+ [selection]',
        //   command: 'atom-terminal-view:send_slash_d',
        // }
      ]
    });


  }

  // serialize() {
  //   return {
  //     deserializer: 'TerminalView'
  //   };
  // }


  close() {
    //console.log('CLOSE TERMINAL', this.now);
    let pane = atom.workspace.paneForItem(this);
    if (pane) {
      //console.log("REMOVE TERMINAL PANE ITEM");
      pane.destroyItem(this);
    } else {
      this.destroy();
    }
  }

  destroy() {
    // console.log("DESTROY psql terminal",this.now);
    // Stop Observing Resize Events
    this._resizeObserver.disconnect();

    if (this.pty && this.ptyRunninFlag) this.pty.kill();

    // Destroy the Terminal Instance
    if (this.terminal) this.terminal.destroy();

    // Detach from the DOM
    etch.destroy(this);

    // Dispose of Disposables
    this.disposables.dispose();
  }

  _handleEvents() {

    // Transfer Focus to Terminal
    this.element.addEventListener('focus', () => this.terminal.focus());

    // Observe Resize Events
    this._resizeObserver = new ResizeObserver(this._didResize.bind(this));
    this._resizeObserver.observe(this.element);
    let self = this;


    if (this.onPaste) {
      this.terminal.on('paste', (data) => {
        self.onPaste.call(self, data);
      });
    }
    if (this.onKey) {
      this.terminal.on('key', (data) => {
        self.onKey.call(self, data);
      });
    }


    // Process Terminal Input Events
    this.terminal.on('data', (data) => {
      //console.log("@on_term:", ">" +data +"<");
      //return this.pty.write(data);
      if (!self.ptyDataRecordFlag && self.terminalEchoON) {
        //console.log("on_term:",data.charCodeAt(0),data.charCodeAt(1),data.charCodeAt(2),data.charCodeAt(3),data.charCodeAt(4),data);
        return this.pty.write(data);
      }
    });
    // Process Terminal Output Events
    this.pty.on('data', (data) => {
      //console.log("@on_pty:", ">" +data +"<");
      //this.ptyData += data;
      if (self.ptyDataRecordFlag) {
        self.ptyData += data;
      } else {
        if (self.terminalEchoON) {
          return this.terminal.write(data);
        }
      }
    });

    this.pty.on('exit', () => {
      self.ptyRunninFlag = false;
      if (this.onExit) {
        this.onExit();
      }
      this.close();
    });

    // Observe Configuration Changes
    // this.disposables.add(
    //   atom.config.observe('atom-terminal-tab.matchTheme', this.applyThemeStyles.bind(this))
    // );

  }

  //
  // Resizes the terminal instance to fit its parent container. Once the new
  // dimensions are established, the calculated columns and rows are passed to
  // the pseudoterminal (pty) to remain consistent.
  //
  _didResize() {

    // Resize Terminal to Container
    this.terminal.fit();

    // Update Pseudoterminal Process w/New Dimensions
    this.pty.resize(this.terminal.cols, this.terminal.rows);

  }

  render() {
    return (
      <psql-terminal-view attributes={{tabindex: 0}}/>
    );
  }

  update() {
    return etch.update(this);
  }

  getPid() {
    return this.pty.pid;
  }


  _openTerminal() {
    this.pty = this._openPseudoterminal();
    this.terminal = new Terminal();
    this.terminal.open(this.element, true);
    this.applyThemeStyles();
  }

  _openPseudoterminal() {
    //console.log("_open PSQL ############################");
    const projectPaths = atom.project.getPaths();
    let cwd;
    if (projectPaths.length > 0) {
      cwd = projectPaths[0];
    } else {
      cwd = process.env.HOME;
    }
    //let system_psql_cmd = atom.config.get('atom-psql.psql.psqlCommand').trim();
    //return spawnPty(process.env.SHELL, [], {
    let my_env = process.env;
    for (let k in this.ENV) {
      my_env[k] = this.ENV[k];
    }
    this.ptyRunninFlag = true;
    return spawnPty(this.CMD, this.ARGS, {
      name: 'xterm-color',
      cwd: path.resolve(cwd),
      env: my_env
    });
  }

  clear() {
    this.terminalEchoON = true;
    this.ptyDataRecordFlag = false;
    this.sendBrake();
    setTimeout(() => {
      this.terminal.clear();
    }, 200);
  }

  sendBrake() {
    let page_breakcmd = atom.config.get('atom-psql.psql.psqlPagerStopSendCommand');
    page_breakcmd = page_breakcmd.replace("CTRL+C", "\x03");
    console.log("SEND PAGER BRAKE", page_breakcmd); //"\x03"
    //this.sendToTerminal(page_breakcmd);
    //this.writeToTerminal(page_breakcmd);
    this.writeToPty(page_breakcmd)
  }

  //
  // Copies the current selection to the Atom clipboard.
  //
  copySelection() {
    let selectedText = window.getSelection().toString();
    let preparedText = this._prepareTextForClipboard(selectedText);
    atom.clipboard.write(preparedText);
  }

  //
  // Pastes the contents of the Atom clipboard to the terminal (via the
  // pseudoterminal).
  //
  pasteFromClipboard() {
    let text = atom.clipboard.read();
    this.onPaste(text);
    //this.pty.write(text);
    this.writeToPty(text);
  }

  //
  // Xterm.js replaces all spaces with non-breaking space characters. Before
  // writing the selection to the clipboard, we need to convert these back to
  // standard space characters.
  //
  // This method was lifted from the Xterm.js source, with some slight
  // modifications.
  //
  _prepareTextForClipboard(text) {
    const space = String.fromCharCode(32);
    const nonBreakingSpace = String.fromCharCode(160);
    const allNonBreakingSpaces = new RegExp(nonBreakingSpace, 'g');

    return text.split('\n').map((line) => {
      return line.replace(/\s+$/g, '').replace(allNonBreakingSpaces, space);
    }).join('\n');
  }

  getDefaultLocation() {
    return 'bottom';
  }

  getIconName() {
    return 'terminal';
  }

  getTitle() {
    let pid = this.pty.pid;
    let db = process.env['PGDATABASE'];

    let sep = '';
    let title = '';
    if (pid) {
      title += (sep + pid);
      sep = '   ';
    }
    if (db) {
      title += (sep + db);
      sep = '   ';
    }
    return title;
  }

  getAllowedLocations() {
    //return ['right', 'left', 'bottom',  'center'];
    return ['bottom'];
  }


  getURI() {
    return this.URI;
  }


  applyThemeStyles() {
    return;
  }


  getTerminal() {
    return this.terminal;
  }


  grabLine = function (lineIndex, trimRight, startCol, endCol) {
    if (startCol === undefined) {
      startCol = 0;
    }
    if (endCol === undefined) {
      endCol = null;
    }
    var lineString = '';
    var line = this.terminal.buffer.lines.get(lineIndex);
    if (!line) {
      return '';
    }
    var startIndex = startCol;
    endCol = endCol || line.length;
    var endIndex = endCol;
    for (var i = 0; i < line.length; i++) {
      var char = line[i];
      lineString += char[CHAR_DATA_CHAR_INDEX];
      if (char[CHAR_DATA_WIDTH_INDEX] === 0) {
        if (startCol >= i) {
          startIndex--;
        }
        if (endCol >= i) {
          endIndex--;
        }
      } else {
        if (char[CHAR_DATA_CHAR_INDEX].length > 1) {
          if (startCol > i) {
            startIndex += char[CHAR_DATA_CHAR_INDEX].length - 1;
          }
          if (endCol > i) {
            endIndex += char[CHAR_DATA_CHAR_INDEX].length - 1;
          }
        }
      }
    }
    if (trimRight) {
      var rightWhitespaceIndex = lineString.search(/\s+$/);
      if (rightWhitespaceIndex !== -1) {
        endIndex = Math.min(endIndex, rightWhitespaceIndex);
      }
      if (endIndex <= startIndex) {
        return '';
      }
    }
    return lineString.substring(startIndex, endIndex);
  };

  grabLastLine() {
    return (this.grabLastLineExt())[1];
  }

  grabLastLineExt() {
    let terminal = this.terminal;
    let y = 0;
    let line = null;
    let ymax = (terminal.buffer.lines.length - 1);

    let terminal_rows_m1 = terminal.rows - 1;
    if (ymax <= terminal_rows_m1) {
      for (let i = terminal_rows_m1; i >= 0; i--) {
        let l = this.grabLine(i, true);
        if (!(l == '')) {
          y = i;
          line = l;
          break;
        }
      }
    } else {
      y = ymax;
      line = this.grabLine(ymax, true);
    }
    if (line == '' && ymax < 1000) {
      let y = ymax - 1;
      while (y > 0 && line == '') {
        y -= 1;
        line = this.grabLine(y, true);
        // line = Utils.trimRight(this.grabLine(y));
      }
    }
    return [y, line];
  }

  writeToPty(data) {
    //console.log("writeToPty",data);
    return this.pty.write(data);
  }

  writeToTerminal(data) {
    // console.log("writeToTerminal",data);
    return this.terminal.write(data);
  }

  sendToTerminal(data) {
    //console.log("sendToTerminal",data);
    return this.terminal.send(data);
  }


  clearPtyData() {
    this.ptyData = '';
  }

  // getPtyData() {
  //   let regexp_prompt1 = this.regexp_prompt1;
  //   let regexp_prompt2 = this.regexp_prompt2;
  //   let data = this.ptyData;
  //   this.clearPtyData();
  //   let lines = data.split(("\n"));
  //   let out = '';
  //   for (let line of lines){
  //     if (!line.match(regexp_prompt1) && !line.match(regexp_prompt2)){
  //       out+=(line + "\n");
  //     }
  //   }
  //   return out;
  // };


  getURI() {
    return 'atom://atom-psql/psql-terminal-view';
  }


  isReadyForCommand() {
    let line = this.grabLastLine();
    return (line.match(this.regexp_prompt1));
  }

  clearPsqlVariables(variables) {
    let self = this;
    //console.log("terminalEchoOFF");
    this.terminalEchoON = false;
    for (let k in variables) {
      let cmd = '\\unset ' + k + "\n";
      this.writeToPty(cmd);
    }
    let timeoutCounter = 0;
    setTimeout(function () {
      self.terminalEchoON = true;
    }, 800);
  }

  getPsqlVariables(callback) {
    //console.log("GET PSQL VARIABLES...");
    let self = this;
    // if (this.isReadyForCommand()) {
    //   this._getPsqlVariables(callback);
    // } else {
    let timeoutCounter = 0;
    let timeout = setInterval(function () {
      timeoutCounter += 1;
      //console.log("getPsqlVariables timoutCounter:",timeoutCounter);
      if (self.isReadyForCommand()) {
        //console.log("#CLEAR1",timeoutCounter);
        self._getPsqlVariables(callback);
        clearInterval(timeout);
      } else if (timeoutCounter > 40) {
        //console.log("timeoutCounter...");
        clearInterval(timeout);
      }
    }, 200);
    // console.log('getPsqlVariables TIMEOUT',timeout);
    //}
  }

  _getPsqlVariables(callback) {
    //console.log("getPsqlVariables");
    let self = this;
    this.ptyDataRecordFlag = true;
    this.ptyData = '';
    //let cmd = '\\set\n\\p\n';
    //let cmd = '\\set\n\\r\n';
    let cmd = '\\set\n';
    //console.log(cmd);
    //console.log("SEND \\set ");
    this.writeToPty(cmd);
    let timeoutCounter = 0;
    let variableParser = Utils.createVariableParser();
    let variables = null;
    let timeout = setInterval(function () {
      let vars = variableParser.parse(self.ptyData);
      let line = variableParser.getLastLine();
      if (variables == null) {
        variables = vars;
      } else {
        for (let k in vars) {
          variables[k] = vars[k];
        }
      }
      if (timeoutCounter > 21 || line.match(self.regexp_prompt1)) {
        //console.log("#CLEAR2",timeoutCounter);
        clearInterval(timeout);
        callback(variables);
        self.ptyData = '';
        self.ptyDataRecordFlag = false;
      }
    }, 80);
    //console.log('_getPsqlVariables TIMEOUT',timeout);
  }

//8 DELETE
//27 91 65 pano velaki
//127 backspace
}

