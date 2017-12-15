/** @babel */
/** @jsx etch.dom */

import {Emitter, CompositeDisposable} from 'atom';
import etch from 'etch';
import {$, $$$} from 'atom-space-pen-views';

export const VARIABLES_VIEW_URI = 'atom://atom-psql/variables-view';

export class AtomPsqlVariablesView {

  variables = {};
  initVariableKeys = null;

  constructor() {
    this.now = new Date().getTime();
    // console.log("NEW AtomPsqlVariablesView",this.now);
    this.disposables = new CompositeDisposable();
    let ttt = etch.initialize(this);
    this.liveFlag = true;
    this.emitter = new Emitter();

    this.disposables.add(atom.commands.add('psql-variables-view', {
        'atom-psql:variables-view-copy': () => {
          //console.log("COPY");
          let selectedText = window.getSelection().toString();
          atom.clipboard.write(selectedText);
        }
      }
    ));
    atom.contextMenu.add({
      'psql-variables-view': [
        {
          label: 'copy',
          command: 'atom-psql:variables-view-copy'
        },
        {
          label: 'refresh',
          command: 'atom-psql:refresh-variables'
        },
        {
          label: 'clear',
          command: 'atom-psql:clear-variables'
        }

      ]
    });

    setTimeout(()=>{
      $('button#example_button').click(()=>{
        let txt = `
SELECT 1 as v1, now() \\gset r_
SELECT :r_v1 + 1 as sum1 \\gset
SELECT :sum1 + 2 as sum2;
`;
        atom.clipboard.write(txt);
      });
    },1000);

  }

  serialize() {
  }

  close() {
    // console.log('CLOSE variables', this.now);
    let pane = atom.workspace.paneForItem(this);
    if (pane) {
      //console.log("REMOVE VARIABLES PANE ITEM");
      pane.destroyItem(this);
    } else {
      this.destroy();
    }
  }

  destroy() {
    // console.log('DESTROY variables', this.now);
    this.liveFlag = false;
    etch.destroy(this);
    this.disposables.dispose();
  }


  render() {
    let now = this.now;
    return (
      <psql-variables-view attributes={{tabindex: 0}}>
        <p>
          <br/>
          for example try:<br/>
          <pre>
            SELECT 1 as v1, now() \gset r_
            <br/>
            SELECT :r_v1 + 1 as sum1 \gset
            <br/>
            SELECT :sum1 + 1 as sum2;
          </pre>
        </p>
        <div class="center">
        <button id="example_button">copy&#160;example&#160;to&#160;clipboard</button>
        </div>

      </psql-variables-view>
    );
  }

  update() {
    return etch.update(this);
  }

  //
  clear() {
  }

  getDefaultLocation() {
    return 'center';
  }

  getTitle() {
    return 'psql Variables';
  }

  getURI() {
    return VARIABLES_VIEW_URI;
  }


  getVariables(){
    return this.variables;
  }
  clearVariables(){
    this.variables={};
    this.setVariabes({});
  }
  setVariabes(variables) {
    //console.log('setVariables',variables);
    let rootEl = this.element;
    $(rootEl).empty();
    let tableEl = $('<table class="psql-variables-table"></table>');
    let ok = false;
    let k, v;
    let self = this;
    let appendToTable = function (k, v) {
      if (k != 'ECHO') {
        ok = true;
        self.variables[k] = v;
        tableEl.append('<tr><td>' + k + '</td><td>' + v + '</td></tr>');
      }
    }
    if (this.initVariableKeys) {
      for (k in variables) {
        //console.log(k,'=>',variables[k]);
        if (this.initVariableKeys.indexOf(k) < 0) {
          appendToTable(k, variables[k])
        }
      }
    } else {
      for (k in variables) {
        appendToTable(k, variables[k]);
      }
    }

    if (ok) {
      tableEl.appendTo(rootEl);
    }
  }



  setInitVariabes(variables) {
    let keys = Object.keys(variables);
    //console.log(keys);
    this.initVariableKeys = keys;
  }


}
