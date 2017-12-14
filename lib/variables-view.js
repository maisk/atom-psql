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
    etch.initialize(this);
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
          try:<br/>
          <pre>select now(), current_user \gset</pre>
        </p>
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
