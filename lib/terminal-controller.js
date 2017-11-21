'use babel';
import fs from 'fs';
import {$, $$$} from 'atom-space-pen-views';
import {PSQLRC, PSQL_EDITOR_CMD, PsqlController, PsqlErrorParser} from "./psql.js";


export default class TerminalController {

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

      let args = [];
      if (PGPASS){
        let psql = new PsqlController({PGPASS:PGPASS});
        let url = psql.getPSQL_CONN_URL();
        args.push(url);
      }
      const shell = atom.config.get('atom-psql.psql.psqlCommand');
      let env = {
        'PSQL_EDITOR': PSQL_EDITOR_CMD,
        'PSQLRC': PSQLRC
      };
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

      activeView.terminal.stopScrolling();
      let terminal_element = activeView.element;
      let last_txt = find_last_txt(terminal_element);
      let regexp_str = atom.config.get('atom-psql.psql.psqlPrompt1Regexp');
      //console.log('LT: >>' + last_txt + '<<');
      let re = new RegExp(regexp_str);
      if (!last_txt || !last_txt.match(re)) {
        //console.log("SEND PAGER BRAKE"); //"\x03"
        let page_breakcmd = atom.config.get('atom-psql.psql.psqlPagerStopSendCommand');
        page_breakcmd = page_breakcmd.replace("CTRL+C", "\x03");
        activeView.input(page_breakcmd);
      }

      activeView.input(text);
      setTimeout(()=> {
        let regexp_str = atom.config.get('atom-psql.psql.psqlPrompt2Regexp');
        let last_txt = find_last_txt(terminal_element);
        let re = new RegExp(regexp_str+'$');
        if (last_txt && last_txt.match(re)){
          activeView.input(";\n");
        }
      },600);

    } else {
     activeView.insertSelection(text);
    }


  }



}
