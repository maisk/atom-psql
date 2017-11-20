'use babel';
import fs from 'fs';
import {$, $$$} from 'atom-space-pen-views';
import streamBuffers from 'stream-buffers';
import {PSQLRC, PSQL_EDITOR_CMD, PsqlControler, PsqlErrorParser} from "./psql.js";


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
        console.log("FoUND");
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

      const shell = atom.config.get('atom-psql.psqlCommand');
      const args = [];
      let env = {
        'PSQL_EDITOR': PSQL_EDITOR_CMD,
        'PSQLRC': PSQLRC
      };
      let psqlTerminalView = statusBar.createEmptyTerminalView(null, shell, args, env);
      psqlTerminalView.toggle();
      psqlTerminalView['ATOM_PSQL_FLAG'] = true;
      this.psqlTerminalView = psqlTerminalView;
      psqlTerminalView.statusIcon.updateName('PSQL');
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
    console.log('sendText');

    let activeView = this.statusBar.getActiveTerminalView();
    if (!activeView){
      return;
    }

    if (activeView['ATOM_PSQL_FLAG']){
      let terminal_element = activeView.element;
      let divs = $(terminal_element).find('div');
      let last_txt = null;
      divs.each((i, elem) => {
        let txt = $(elem).text();
        if (!txt.match(/^\s*$/)) {
          last_txt = txt;
        }
      });

      let regexp_str = atom.config.get('atom-psql.psqlPromptRegexp');
      //console.log('LT: >>' + last_txt + '<<');
      let re = new RegExp(regexp_str);
      if (!last_txt || !last_txt.match(re)) {
        //console.log("SEND PAGER BRAKE"); //"\x03"
        let page_breakcmd = atom.config.get('atom-psql.psqlPagerStopSendCommand');
        page_breakcmd = page_breakcmd.replace("CTRL+C", "\x03");
        activeView.insertSelection(page_breakcmd);
      }
    }
    activeView.insertSelection(text);

  }



}
