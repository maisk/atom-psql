'use babel';
import fs from 'fs';
import {$, $$$} from 'atom-space-pen-views';
import {PSQLRC, PSQL_EDITOR_CMD, PsqlController, PsqlErrorParser, psqlCommandControllerInstance} from './psql';
import {PsqlQueryParser} from './psql-query-parser';
import Utils from './utils.js';

export const TERMINAL_PSQL_CMD = '/tmp/.atom-psql-shell';

export class TerminalController {

  terminalService = null;
  statusBar = null;
  psqlTerminalView = null;

  constructor(terminalService) {
    this.terminalService = terminalService;
  }


  getTerminalViews() {
    //return this.terminalService.getTerminalViews();
    return this.statusBar.terminalViews;

  }

  open(){
    this.init();
    if (this.psqlTerminalView){
      this.psqlTerminalView.toggle();
    }
  }


  grabLastLine(terminal){
    if (!terminal) {
      if (!this.psqlTerminalView) {
        return null;
      }
      terminal = this.psqlTerminalView.getTerminal();
    }
    let line = null;
    let ymax = (terminal.lines.length - 1);
    let xmax = (terminal.lines[ymax].length -1);
    let ymin = ymax;
    let terminal_rows_m1 = terminal.rows -1;
    if (ymax <= terminal_rows_m1){
      for (let i=terminal_rows_m1; i>=0; i--){
        let l = terminal.grabText(0, xmax, i,i);
        if (! (l.trim() == '')){
          line = l;
          break;
        }
      }
    } else {
      line = Utils.trimRight(terminal.grabText(0, xmax, ymin , ymax));
    }
    return line;
  }

  init(options) {
    let restoreFousFlag = false;
    if (!options) {
      options = {};
    }
    if (options['restoreFocus']) {
      restoreFousFlag = options['restoreFocus'];
    }
    let terminal_name = ( options['name']) ? options['name'] : 'PSQL';
    let PGPASS = ( options['PGPASS']) ? options['PGPASS'] : null;
    if (!this.statusBar) {
      let terminalPackage = atom.packages.getActivePackage('platformio-ide-terminal');
      let terminalMainModule = terminalPackage.mainModule;
      this.statusBar = terminalMainModule.statusBarTile;
    }
    let statusBar = this.statusBar;

    let tviews = this.getTerminalViews();
    let foundFlag = false;
    for (let tview of tviews) {
      if (tview['ATOM_PSQL_FLAG']) {
        foundFlag = true;
      }
    }
    if (!foundFlag) {
      //console.log("REMOVE TERMINAL");
      this.psqlTerminalView = null;
    }

    if (this.psqlTerminalView && options['clean']) {
      this.psqlTerminalView.destroy();
      this.psqlTerminalView = null;
    }
    if (!this.psqlTerminalView) {
     // console.log("CREATE TERMINAL PSQL");

      let previouslyFocusedElement = null;
      if (restoreFousFlag) {
        if (options['restoreFocusElement']) {

          previouslyFocusedElement = options['restoreFocusElement'];
        } else {
          previouslyFocusedElement = $(':focus');
        }
      }

      let system_psql_cmd = atom.config.get('atom-psql.psql.psqlCommand').trim();
      let TERMINAL_PSQL_CMD_CONTENT = "#!/bin/bash\n" + '"' + system_psql_cmd + '"  -b ' + ' "$@" 2> /tmp/atom-psql-fifo-errors' + "\n";
      if (!fs.existsSync(TERMINAL_PSQL_CMD)) {
        fs.writeFileSync(TERMINAL_PSQL_CMD, TERMINAL_PSQL_CMD_CONTENT);
        fs.chmodSync(TERMINAL_PSQL_CMD, '755');
      }


      let args = [];
      if (PGPASS) {
        let psql = new PsqlController({PGPASS: PGPASS});
        let url = psql.getPSQL_CONN_URL();
        args.push(url);
      }
      //args.push('2> /tmp/atom-psql-fifo-errors');
      let env = {
        'PSQL_EDITOR': PSQL_EDITOR_CMD,
        'PSQLRC': PSQLRC
      };
      const shell = TERMINAL_PSQL_CMD;
      //'\\conninfo'
      let psqlTerminalView = statusBar.createEmptyTerminalView([], shell, args, env);
      psqlTerminalView.toggle();
      psqlTerminalView['ATOM_PSQL_FLAG'] = true;
      this.psqlTerminalView = psqlTerminalView;
      psqlTerminalView.statusIcon.updateName(terminal_name);
      if (previouslyFocusedElement) {
        this.restoreFocus(previouslyFocusedElement, 1000);
      }

      let commandController = psqlCommandControllerInstance;
      let queryParser = new PsqlQueryParser();
      let regexp_prompt1_str = atom.config.get('atom-psql.psql.psqlPrompt1Regexp');
      let regexp_prompt2_str = atom.config.get('atom-psql.psql.psqlPrompt2Regexp');
      let regexp_prompt1 = new RegExp('(' + regexp_prompt1_str + ')');
      let regexp_prompt2 = new RegExp('(' + regexp_prompt2_str + ')');

      let self =this;
      setTimeout(function () {
        let terminal = psqlTerminalView.getTerminal();
        //console.log(terminal);
        terminal.on('data', function (data) {
          if (data.charCodeAt(0) == 13) {
            let x = terminal.x;
            let tl = terminal.lines.length - 1;
            let ty = terminal.y;
            let y = (tl >= terminal.rows) ? tl : ty;
            let line = terminal.grabText(0, x, y, y);
            // console.log('1>>',self.grabLastLine(terminal));
            // console.log("2>>",line);
            let line_clean = null;
            let m = null;
            let cmd1 = null;
            let cmd2 = null;
            let pr = 0;
            if (m = line.match(regexp_prompt1)) {
              let len = m[0].length;
              cmd1 = line.substring(len, x).trim();
               pr = queryParser.addLine(cmd1);
            } else if (m = line.match(regexp_prompt2)) {
              let len = m[0].length;
              cmd2 = line.substring(len, x).trim();
                pr = queryParser.addLine(cmd2);
            }
            if (pr && pr > 1) {
              let cmds = queryParser.getQueriesExtend();
              queryParser.reset();
              if (cmds && cmds.length > 0) {
                for (let cmd of cmds){
                  commandController.checkCommand(cmd);
                }
              }
            }

          }
        });
      }, 2000);

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
    if (!text) {
      return;
    }

    if (this.init({'restoreFocus': true})) {
      return;
    }
    let activeView = this.statusBar.getActiveTerminalView();
    if (!activeView) {
      return;
    }

    if (activeView['ATOM_PSQL_FLAG']) {
      let insertTextToView = function (view, txt) {
        view.input(text);
        if (!text.match(/\s*\n$/)) {
          view.input("\n");
        }
      };
      let terminal = activeView.getTerminal();
      terminal.stopScrolling();
      // let terminal_element = activeView.element;
      // let last_txt = find_last_txt(terminal_element);
      let last_txt = this.grabLastLine(terminal);
      let regexp_str = atom.config.get('atom-psql.psql.psqlPrompt1Regexp');
      //console.log('LT: >>' + last_txt + '<<');
      let re = new RegExp(regexp_str);
      if (!last_txt || !last_txt.match(re)) {
        let page_breakcmd = atom.config.get('atom-psql.psql.psqlPagerStopSendCommand');
        page_breakcmd = page_breakcmd.replace("CTRL+C", "\x03");
        //console.log("SEND PAGER BRAKE",page_breakcmd); //"\x03"
        activeView.input(page_breakcmd);
        setTimeout(() => {
          insertTextToView(activeView, text);
        }, 200);
      } else {
        insertTextToView(activeView, text);
      }

    } else {
      activeView.insertSelection(text);
    }


  }


}