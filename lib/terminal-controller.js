'use babel';
import fs from 'fs';
import {$, $$$} from 'atom-space-pen-views';
import {PSQLRC, PSQL_EDITOR_CMD, PsqlController, PsqlErrorParser, psqlCommandControllerInstance} from './psql';
import {PsqlQueryParser} from './psql-query-parser';
import Utils from './utils.js';
import {TerminalView} from './terminal-view';

export const TERMINAL_PSQL_CMD = '/tmp/.atom-psql-shell';

export const TERMINAL_TAB_URI = 'atom://atom-psql/terminal';

export class TerminalController {

  //terminalService = null;
  //statusBar = null;
	psqlTerminalView = null;
	PGPASS = null;
//	terminalViews = [];




	constructor() {
	  //let self = this;
		//console.log("construct terminal-controller");
  }


  // getTerminalViews() {
  //   //return this.terminalService.getTerminalViews();
  //   return this.statusBar.terminalViews;
  //
  // }
  //


	openFromUri(){
		console.log("#openFromUri");
		this.init();


	}

  open(){
    if (!this.init() && this.psqlTerminalView){
	    atom.workspace.getBottomDock().show();
    } else {
      console.log('??');
    }
  }

  toggle(){
		if (!this.psqlTerminalView){
			console.log("TERMINAL TOGGLE#1");
			this.init();
			return;
		}

		let pid = this.psqlTerminalView.pty.pid;
		console.log('pid',pid);
		if (!Utils.isPidRunning(pid)){
			console.log("TERMINAL TOGGLE#2");
			this.close();
			this._createPsql(this.PGPASS);
		} else {
			console.log("TERMINAL TOGGLE#3",this.psqlTerminalView);
			atom.workspace.toggle(this.psqlTerminalView);
		}
  }

  clear(){
	  if (this.psqlTerminalView){
		  let tv = this.psqlTerminalView;
		  let t = tv.getTerminal();
		  t.reset();
		  tv.input("\n");
	  }
  }


  grabLine(y){
	  let terminal = this.psqlTerminalView.getTerminal();
		let line = terminal.buffer.lines.get(y);
		if (!line){
			//console.log("line???",y);
			return '';
		}
	  let lineStr = '';
	  let c;
		for (c of line){
			lineStr += c[1];
		}
	  //console.log('grabLine',y,lineStr);
	  return lineStr;
  }


	grabLastLine(){
		let terminal = this.psqlTerminalView.getTerminal();
    let line = null;
    let ymax = (terminal.buffer.lines.length - 1);
		//console.log('Y:',ymax);

		//let xmax = (terminal.buffer.lines[ymax].length -1); //??
    //let xmax = 40;
    let ymin = ymax;
		//console.log('X:',xmax);

    let terminal_rows_m1 = terminal.rows -1;
    if (ymax <= terminal_rows_m1){
      for (let i=terminal_rows_m1; i>=0; i--){
        let l = this.grabLine(i);
      	//let l = terminal.grabText(0, xmax, i,i);
        if (! (l.trim() == '')){
          line = l;
          break;
        }
      }
    } else {
      //line = Utils.trimRight(terminal.grabText(0, xmax, ymin , ymax));
	    line = Utils.trimRight(this.grabLine( ymax));
    }
    if (line == '' && ymax < 1000){
      let y = ymax -1;
      while(y>0 && line ==''){
        y-=1;
        //line = Utils.trimRight(terminal.grabText(0, xmax, y , y));
	      line = Utils.trimRight(this.grabLine(y));
      }
    }
    return line;
  }

	_createPsql(PGPASS){
	  console.log("CREATE NEW TERMINAL PSQL#: ",PGPASS);
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
	  this.psqlTerminalView = new TerminalView({'uri':TERMINAL_TAB_URI, args:args, env:env, cmd:TERMINAL_PSQL_CMD,});
	  atom.workspace.open(this.psqlTerminalView);
	  return this.psqlTerminalView;
  }

  init(options) {
    console.log("INIT terminal-controller");

	  let restoreFousFlag = false;
	  if (!options) {
		  options = {};
	  }

	  // if (options['restoreFocus']) {
		 //  restoreFousFlag = options['restoreFocus'];
	  // }



	  let PGPASS = this.PGPASS;
	  if ( options['PGPASS']){
		  PGPASS = options['PGPASS'];
		  this.PGPASS = PGPASS;
	  }

	  if (this.psqlTerminalView && options && options['clean']){
		  console.log("DESTROY PSQL TERMINAL");
	    this.close();
    }
	  if (!this.psqlTerminalView) {
		  let system_psql_cmd = atom.config.get('atom-psql.psql.psqlCommand').trim();
		  let TERMINAL_PSQL_CMD_CONTENT = "#!/bin/bash\n" + '"' + system_psql_cmd + '"  -b ' + ' "$@" 2> /tmp/atom-psql-fifo-errors' + "\n";
		  if (!fs.existsSync(TERMINAL_PSQL_CMD)) {
			  fs.writeFileSync(TERMINAL_PSQL_CMD, TERMINAL_PSQL_CMD_CONTENT);
			  fs.chmodSync(TERMINAL_PSQL_CMD, '755');
		  }
		  return this._createPsql(PGPASS);
	  } else {
		  let pid = this.psqlTerminalView.pty.pid;
		  if (!Utils.isPidRunning(pid)) {
			  console.log("terminal is not running");
			  this.close();
			  return this._createPsql(PGPASS);
		  }

		  this.psqlTerminalView;
		  return false;
	  }



	  return false;


    // let restoreFousFlag = false;
    // if (!options) {
    //   options = {};
    // }
    // if (options['restoreFocus']) {
    //   restoreFousFlag = options['restoreFocus'];
    // }
    // let terminal_name = ( options['name']) ? options['name'] : 'PSQL';
    // let PGPASS = ( options['PGPASS']) ? options['PGPASS'] : null;
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
      console.log("REMOVE TERMINAL");
      this.psqlTerminalView = null;
    }

    if (this.psqlTerminalView && options['clean']) {
      this.psqlTerminalView.destroy();
      this.psqlTerminalView = null;
    }
    if (!this.psqlTerminalView) {
      console.log("CREATE TERMINAL PSQL");

      // let previouslyFocusedElement = null;
      // if (restoreFousFlag) {
      //   if (options['restoreFocusElement']) {
      //
      //     previouslyFocusedElement = options['restoreFocusElement'];
      //   } else {
      //     previouslyFocusedElement = $(':focus');
      //   }
      // }

      // let system_psql_cmd = atom.config.get('atom-psql.psql.psqlCommand').trim();
      // let TERMINAL_PSQL_CMD_CONTENT = "#!/bin/bash\n" + '"' + system_psql_cmd + '"  -b ' + ' "$@" 2> /tmp/atom-psql-fifo-errors' + "\n";
      // if (!fs.existsSync(TERMINAL_PSQL_CMD)) {
      //   fs.writeFileSync(TERMINAL_PSQL_CMD, TERMINAL_PSQL_CMD_CONTENT);
      //   fs.chmodSync(TERMINAL_PSQL_CMD, '755');
      // }
      //

      // let args = [];
      // if (PGPASS) {
      //   let psql = new PsqlController({PGPASS: PGPASS});
      //   let url = psql.getPSQL_CONN_URL();
      //   args.push(url);
      // }
      //args.push('2> /tmp/atom-psql-fifo-errors');
      // let env = {
      //   'PSQL_EDITOR': PSQL_EDITOR_CMD,
      //   'PSQLRC': PSQLRC
      // };
      // const shell = TERMINAL_PSQL_CMD;
      // //'\\conninfo'
      // let psqlTerminalView = statusBar.createEmptyTerminalView([], shell, args, env);
      // psqlTerminalView.toggle();
      // psqlTerminalView['ATOM_PSQL_FLAG'] = true;
      // this.psqlTerminalView = psqlTerminalView;
      // psqlTerminalView.statusIcon.updateName(terminal_name);
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
            let tl = terminal.buffer.lines.length - 1;
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
		//console.log("terminal-controler.sendText",text);
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


    //if (activeView['ATOM_PSQL_FLAG']) {
      let insertTextToTerm = function (terminal, text) {
	      terminal.send(text);
        if (!text.match(/\s*\n$/)) {
	        terminal.send("\n");
        }
      };
      let terminal = activeView.getTerminal();
      let last_txt = this.grabLastLine();
      let regexp_str = atom.config.get('atom-psql.psql.psqlPrompt1Regexp');
      console.log('LT: >>' + last_txt + '<<');
      let re = new RegExp(regexp_str);
      if (!last_txt || !last_txt.match(re)) {
        let page_breakcmd = atom.config.get('atom-psql.psql.psqlPagerStopSendCommand');
        page_breakcmd = page_breakcmd.replace("CTRL+C", "\x03");
        console.log("SEND PAGER BRAKE",page_breakcmd); //"\x03"
        terminal.send(page_breakcmd);
        setTimeout(() => {
          insertTextToTerm(terminal, text);
        }, 200);
      } else {
        insertTextToTerm(terminal, text);
      }

   // } else {
  //    activeView.insertSelection(text);
   // }


  }


  close(){
		this.psqlTerminalView.destroy();
		this.psqlTerminalView = null;
  }


}