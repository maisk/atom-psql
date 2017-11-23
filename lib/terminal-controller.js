'use babel';
import fs from 'fs';
import {$, $$$} from 'atom-space-pen-views';
import {PSQLRC, PSQL_EDITOR_CMD, PsqlController, PsqlErrorParser} from "./psql.js";

export const TERMINAL_PSQL_CMD = '/tmp/.atom-psql-shell';

export class TerminalController {

  terminalService = null;
  statusBar = null;
  psqlTerminalView = null;

  constructor(terminalService) {
    this.terminalService = terminalService;
  }


  getTerminalViews(){
    //return this.terminalService.getTerminalViews();
    return this.statusBar.terminalViews;

  }

  init(options) {
    let restoreFousFlag = false;
    if (!options){
      options ={};
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

    if (this.psqlTerminalView && options['clean']){
      this.psqlTerminalView.destroy();
      this.psqlTerminalView = null;
    }

    if (!this.psqlTerminalView) {
      //console.log("CREATE TERMINAL PSQL");

      let previouslyFocusedElement = null;
      if (restoreFousFlag){
        if( options['restoreFocusElement']){

          previouslyFocusedElement =  options['restoreFocusElement'];
        } else {
          previouslyFocusedElement =  $(':focus');
        }
      }

      let system_psql_cmd = atom.config.get('atom-psql.psql.psqlCommand').trim();
      let TERMINAL_PSQL_CMD_CONTENT = "#!/bin/bash\n" + '"' + system_psql_cmd+ '"  -b ' +' "$@" 2> /tmp/atom-psql-fifo-errors' +"\n";
      if (!fs.existsSync(TERMINAL_PSQL_CMD)) {
        fs.writeFileSync(TERMINAL_PSQL_CMD, TERMINAL_PSQL_CMD_CONTENT);
        fs.chmodSync(TERMINAL_PSQL_CMD, '755');
      }


      let args = [];
      if (PGPASS){
        let psql = new PsqlController({PGPASS:PGPASS});
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
    if (!text){
      return;
    }

    if (this.init({'restoreFocus':true})) {
      return;
    }
    let activeView = this.statusBar.getActiveTerminalView();
    if (!activeView){
      return;
    }

    if (activeView['ATOM_PSQL_FLAG']){

      let find_last_txt = function(terminal_element){
        let divs = $(terminal_element).find('div');
        let last_txt = null;
        divs.each((i, elem) => {
          let txt = $(elem).text();
          if (!txt.match(/^\s*$/)) {
            last_txt = txt;
          }
        });
        return last_txt;
      }

      let insertTextToView =function(view,txt){
        view.input(text);
        if (!text.match(/\s*\n$/)){ view.input("\n");     }
      };

      activeView.terminal.stopScrolling();
      let terminal_element = activeView.element;
      let last_txt = find_last_txt(terminal_element);
      let regexp_str = atom.config.get('atom-psql.psql.psqlPrompt1Regexp');
      //console.log('LT: >>' + last_txt + '<<');
      let re = new RegExp(regexp_str);
      if (!last_txt || !last_txt.match(re)) {
        let page_breakcmd = atom.config.get('atom-psql.psql.psqlPagerStopSendCommand');
        page_breakcmd = page_breakcmd.replace("CTRL+C", "\x03");
        //console.log("SEND PAGER BRAKE",page_breakcmd); //"\x03"
        activeView.input(page_breakcmd);
        setTimeout(()=> {
          insertTextToView(activeView,text);
        },200);
      } else {
        insertTextToView(activeView,text);
      }
      // setTimeout(()=> {
      //   let regexp_str = atom.config.get('atom-psql.psql.psqlPrompt2Regexp');
      //   let last_txt = find_last_txt(terminal_element);
      //   let re = new RegExp(regexp_str+'$');
      //   if (last_txt && last_txt.match(re)){
      //     activeView.input(";\n");
      //   }
      // },600);

    } else {
     activeView.insertSelection(text);
    }


  }



}
