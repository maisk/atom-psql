'use babel';
import fs from 'fs';
import {$, $$$} from 'atom-space-pen-views';
import {PSQLRC, PSQL_EDITOR_CMD, PsqlController, PsqlErrorParser, psqlCommandControllerInstance} from './psql';
import {PsqlQueryParserLine} from './psql-query-parser-line';
import Utils from './utils.js';
import {TerminalView} from './terminal-view';
import {VARIABLES_VIEW_URI, AtomPsqlVariablesView} from './variables-view';
import {Emitter} from 'atom';


export const TERMINAL_PSQL_CMD = '/tmp/.atom-psql-shell';

export const TERMINAL_TAB_URI = 'atom://atom-psql/terminal';

export class TerminalController {

  //terminalService = null;
  //statusBar = null;
  psqlTerminalView = null;
  variablesView = null;
  PGPASS = null;
//	terminalViews = [];
  regexp_prompt1 = null;


  constructor() {
    this.regexp_prompt1 = new RegExp(atom.config.get('atom-psql.psql.psqlPrompt1Regexp'));
    this.regexp_prompt2 = new RegExp(atom.config.get('atom-psql.psql.psqlPrompt2Regexp'));
    this.emitter = new Emitter();
    //let self = this;
    //console.log("construct terminal-controller");
  }


  // getTerminalViews() {
  //   //return this.terminalService.getTerminalViews();
  //   return this.statusBar.terminalViews;
  //
  // }
  //


  openFromUri() {
    // console.log("#openFromUri");
    this.init();
  }



  _initVariablesView() {
    //console.log("_initVariablesView");
    let initFlag = false;
    if (!this.variablesView) {
      initFlag = true;
    } else if (!this.variablesView.liveFlag) {
      initFlag = true;
      //se periptosi pou exi afere8i apo to xristi to item apo to pane
      this.variablesView.close();
    }

    if (initFlag) {
      // console.log("NEW VARIABLES VIEW");
      let variablesView = new AtomPsqlVariablesView();
      this.variablesView = variablesView;

      let psql = new PsqlController({
        PGPASS: this.PGPASS
      });
      let SQL = "\\set";
      let handler = function (error, stdout, stderr) {
        if (!error) {
          let variableParser = Utils.createVariableParser();
          let vars = variableParser.parse(stdout);
          variablesView.setInitVariabes(vars);
          //variablesView.setVariabes(vars);
        } else {
          atom.notifications.addError('psql variables error: ' + error);
        }
        if (stderr) {
          atom.notifications.addError('psql variables error: <br/><pre>' + stderr + '</pre>', {dismissable: true});
        }
      }
      psql.execRaw(SQL, handler);

      //console.log("OPEN VARIABLES");
      atom.workspace.open(this.variablesView, {
        location: 'right',
        //location: 'center',
        activatePane: 'false',
        activateItem: 'false',
        //'split': 'right',
      });
    }
  }


  activate(delay) {
    let timeout = (!delay) ? 0 : delay;
    let self = this;
    setTimeout(() => {
      if (self.psqlTerminalView) {
        let pane = atom.workspace.paneForItem(self.psqlTerminalView);
        if (pane) {
          pane.activateItem(self.psqlTerminalView);
        }
      }
    }, timeout);
  }

  toggle() {
    //oconsole.log("terminal-controller toggle");
    this._initVariablesView();

    if (!this.psqlTerminalView) {
      //console.log("TERMINAL TOGGLE# NOT PSQLTERMINAL VIEW");
      this.init();
      return;
    }
    let pid = this.psqlTerminalView.getPid();
    //console.log('pid', pid);
    if (!Utils.isPidRunning(pid)) {
      //console.log('psql with pid', pid, 'is not running');
      this.close();
      this._createPsql(this.PGPASS);
      return;
    }

    let bdock = atom.workspace.getBottomDock();
    bdock.toggle();
    if (bdock.isVisible()) {
      this.activate();
	    this.psqlTerminalView.element.focus();
    }

	  //atom.workspace.toggle(this.psqlTerminalView);
    // let bottomDock = atom.workspace.getBottomDock();
    // bottomDock.toggle();

  }

  clear() {
    if (this.psqlTerminalView) {
      this.psqlTerminalView.clear();
    }


    // let selection = this.psqlTerminalView.getTerminal().getSelection();
    // console.log(selection);
    // if (this.psqlTerminalView) {
    //   this.psqlTerminalView.getPsqlVariables();
    // }
    //console.log(this.psqlTerminalView.getPtyData());
    //console.log("------------------------------------");
  }


  // writeToPty(data) {
  //   return this.psqlTerminalView.writeToPty(data);
  // }
  //
  // writeToTerminal(data){
  //   return this.psqlTerminalView.writeToTerminal(data)
  // }
  //
  // sendToTerminal(data){
  //   return this.psqlTerminalView.sendToTerminal(data);
  // }

  sendBrake() {
    this.psqlTerminalView.sendBrake();
  }

  grabLine(lineIndex, trimRight, startCol, endCol) {
    this.psqlTerminalView.grabLine(lineIndex, trimRight, startCol, endCol);
  }

  grabLastLine() {
    return this.psqlTerminalView.grabLastLine();
  }

  getPsqlVariables(callback) {
    return this.psqlTerminalView.getPsqlVariables(callback);
  }

  clearPsqlVariableView() {
    this._initVariablesView();
    let self = this;
    let variables = this.variablesView.getVariables();
    this.psqlTerminalView.clearPsqlVariables(variables);
    this.variablesView.clearVariables();
    setTimeout(function () {
      let workspaceElement = atom.views.getView(atom.workspace);
      atom.commands.dispatch(workspaceElement, 'atom-psql:updateVariablesProvider');
    }, 2000);

  }

  updatePsqlVariableView() {
    //console.log("@@updatePsqlVariableView");
    this._initVariablesView();
    let self = this;
    let callback = function (vars) {
      self.variablesView.setVariabes(vars);
    }
    this.psqlTerminalView.getPsqlVariables(callback);
    setTimeout(function () {
      let workspaceElement = atom.views.getView(atom.workspace);
      atom.commands.dispatch(workspaceElement, 'atom-psql:updateVariablesProvider');
    }, 2000);
  }


  _createPsql(PGPASS) {
    //console.log("CREATE NEW TERMINAL PSQL");
    let args = [];
    if (PGPASS) {
      let psql = new PsqlController({PGPASS: PGPASS});
      let url = psql.getPSQL_CONN_URL();
      args.push(url);
    }

    let env = {
      'PSQL_EDITOR': PSQL_EDITOR_CMD,
      'PSQLRC': PSQLRC
    };

    let self = this;
    let commandController = psqlCommandControllerInstance;
    let queryParser = new PsqlQueryParserLine();
    // let onExit = function () {
    //   //console.log("PSQL onEXIT");
    // }
    let onKey = function (data) {
      //console.log("⚠ @onKey1", data);
      if (data.charCodeAt(0) == 13) {
        let last_line_data = this.grabLastLineExt();
        let y = last_line_data[0];
        let line = last_line_data[1];
        //console.log("⚠ @onKey2", line);
        let m = null;
        let cmd1 = null;
        let cmd2 = null;
        let pr = 0;
        if (m = line.match(self.regexp_prompt1)) {
          //let x = this.terminal.x;
          let len = m[0].length;
          let cmd1 = line.substring(len).trim();
          pr = queryParser.addLine(cmd1);
          //console.log('m1', pr, cmd1);
          if ((pr == '4' || pr == '0') && cmd1.match("^\\\\e")) {
            let watch_file = '/tmp/atom-psql-fifo';
            let ic = 0;
            let interval = setInterval(() => {
              ic += 1;
              //console.log("ic:", ic);
              if (ic > 30 || fs.existsSync(watch_file)) {
                clearInterval(interval);
                if (ic < 30) {
                  setTimeout(() => {
                    let editor;
                    if (editor = atom.workspace.getActiveTextEditor()) {
                      fs.readFile(watch_file, 'utf8', (err, text) => {
                        if (err) {
                          atom.notifications.addError(JSON.stringify(err));
                        } else {
                          editor.moveToEndOfLine();
                          editor.insertText(text);
                        }
                      });
                    }
                    fs.unlink(watch_file, (err) => {
                      if (err) {
                        atom.notifications.addError(JSON.stringify(err));
                      }
                    });
                  }, 200);
                }
              }
            }, 100);

          }
        } else if (m = line.match(self.regexp_prompt2)) {
          //let x = this.terminal.x;
          let len = m[0].length;
          cmd2 = line.substring(len).trim();
          pr = queryParser.addLine(cmd2);
          //console.log('m2',pr,cmd1);
        } else {
          c = 0;
          let cmd;
          let buf = [];
          while (c < 40) {
            c += 1;
            y -= 1;
            let l1 = this.grabLine(y);
            if (m = l1.match(self.regexp_prompt1)) {
              let len = m[0].length;
              cmd = l1.substring(len).trim();
              c = 100;
            } else if (m = l1.match(self.regexp_prompt2)) {
              let len = m[0].length;
              cmd = l1.substring(len).trim();
              c = 100;
            } else {
              buf.push(l1.trim());
            }
          }
          let len = buf.length;
          for (let i = len; i--; i <= 0) {
            cmd += buf[i];
          }
          cmd += line;
          pr = queryParser.addLine(cmd);
        }
        if (pr && pr > 1) {
          //console.log('pr>1:',pr);
          let gsetFlag = false;
          let cmds = queryParser.getQueriesExtend();
          queryParser.reset();
          if (cmds && cmds.length > 0) {
            for (let cmd of cmds) {
              //console.log(cmd);
              let checks = commandController.checkCommand(cmd);
              if (!gsetFlag) {
                gsetFlag = Utils.checkCommandReplyHasGset(checks);
              }
            }
          }
          if (gsetFlag) {
            //console.log("GSET FROM KEY");
            self.updatePsqlVariableView();
          }
        }

      }
    }

    let onPaste = function (data) {
      //console.log("⚠ @onPaste", '>'+ data + '<');
      queryParser.addText(data);
      let cmds = queryParser.getQueriesExtend();
      queryParser.reset();
      let gsetFlag = false;
      if (cmds && cmds.length > 0) {
        for (let cmd of cmds) {
          let checks = commandController.checkCommand(cmd);
          if (data.includes("\n")) {
            if (!gsetFlag) {
              gsetFlag = Utils.checkCommandReplyHasGset(checks);
            }
          }
        }
      }
      if (gsetFlag) {
        //console.log("GSET FROM PASTE");
        self.updatePsqlVariableView();
      }
    }

    this.psqlTerminalView = new TerminalView({
      'uri': TERMINAL_TAB_URI,
      args: args,
      env: env,
      cmd: TERMINAL_PSQL_CMD,
      onKey: onKey,
      onPaste: onPaste,
      //onExit: onExit
    });


    //console.log("OPEN PSQL TERMINAL");
    atom.workspace.open(this.psqlTerminalView, {
      'location': 'bottom',
      activatePane: 'true',
      activateItem: 'true'
    });//'split':'left'

    this._initVariablesView();
    this.activate();
    return this.psqlTerminalView;
  }

  init(options) {
    //console.log("INIT terminal-controller");
    let restoreFousFlag = false;
    let previouslyFocusedElement = null;
    if (!options) {
      options = {};
    }

    // if (options['restoreFocus']) {
    //   restoreFousFlag = options['restoreFocus'];
    //   //console.log("@ restoreFocus:",restoreFousFlag);
    //   if (restoreFousFlag) {
    //     if (options['restoreFocusElement']) {
    //       previouslyFocusedElement = options['restoreFocusElement'];
    //     } else {
    //       previouslyFocusedElement = $(':focus');
    //     }
    //     //console.log("@ previouslyFocusedElement:",previouslyFocusedElement);
    //   }
    // }
    // if (previouslyFocusedElement) {
    //   this.restoreFocus(previouslyFocusedElement, 1000);
    // }


    let PGPASS = this.PGPASS;
    if (options['PGPASS']) {
      PGPASS = options['PGPASS'];
      this.PGPASS = PGPASS;
    }

    if (this.psqlTerminalView && options && options['clean']) {
      //console.log("DESTROY PSQL TERMINAL");
      this.close();
    }
    if (!this.psqlTerminalView) {
      let system_psql_cmd = atom.config.get('atom-psql.psql.psqlCommand').trim();
      let TERMINAL_PSQL_CMD_CONTENT = "#!/bin/bash\n" + '"' + system_psql_cmd + '"  -b ' + ' "$@" 2> /tmp/atom-psql-fifo-errors' + "\n";
      if (!fs.existsSync(TERMINAL_PSQL_CMD)) {
        fs.writeFileSync(TERMINAL_PSQL_CMD, TERMINAL_PSQL_CMD_CONTENT);
        fs.chmodSync(TERMINAL_PSQL_CMD, '755');
      }
      //console.log("term-init 1 (create)");
      this._createPsql(PGPASS);
      return true;
    }

    let pid = this.psqlTerminalView.getPid();
    if (!Utils.isPidRunning(pid)) {
      //console.log("terminal is not running create new");
      this.close();
      this._createPsql(PGPASS);
      return true;
    }


    return false;
  }


  restoreFocus(previouslyFocusedElement, waitBeforeRestoreMs) {
    // console.log("RESTORE FOCUS");
    if (previouslyFocusedElement.get()) {
      let check_counter = 0;
      let intervalId = setInterval(() => {
        check_counter += 1;
        if (check_counter > 20) {
          //console.log("???");
          clearInterval(intervalId);
        }
        let new_focus = $(':focus');
        if (!new_focus.is(previouslyFocusedElement)) {
          //console.log("RESTORE OK1");
          setTimeout(() => {
            //console.log("RESTORE OK2");
            previouslyFocusedElement.focus();
          }, waitBeforeRestoreMs);
          clearInterval(intervalId);
        }
      }, 100);
    }
  }


  sendText(text) {
    //console.log("terminal-controler.sendText", text);
    if (!text) {
      return;
    }

    if (this.init({'restoreFocus': true})) {
      return;
    }

    let activeView = this.psqlTerminalView;
    if (!activeView) {
      return;
    }


    let insertTextToTerm = function (terminal, text) {
      terminal.writeToPty(text);
      if (!text.match(/\s*\n$/)) {
        terminal.writeToPty("\n");
      }
    };
    let last_txt = this.grabLastLine();
    //console.log('LT: >>' + last_txt + '<<');
    if (!last_txt || !last_txt.match(this.regexp_prompt1)) {
      activeView.sendBrake();
      setTimeout(() => {
        insertTextToTerm(activeView, text);
      }, 200);
    } else {
      insertTextToTerm(activeView, text);
    }

  }

  isReadyForCommand() {
    if (this.psqlTerminalView) {
      return this.psqlTerminalView.isReadyForCommand();
    }
    return false;
  }

  close() {
    //console.log("TERMINALC CLOSE");
    if (this.variablesView) {
      this.variablesView.close();
      this.variablesView = null;
    }
    if (this.psqlTerminalView) {
      this.psqlTerminalView.close();
      this.psqlTerminalView = null;
    }
  }


}