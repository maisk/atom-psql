"use babel";
/** @jsx etch.dom */

import etch, {getScheduler} from 'etch';
import {CompositeDisposable} from 'atom';
import {PsqlController, PsqlErrorParser} from "./psql.js";
import {$, $$$} from 'atom-space-pen-views';


module.exports = class TdDialog {

  constructor(tdData, onSave) {
    this.onSaveClicked = onSave;

    this.state = {
    };

    etch.initialize(this);
    this.initModels(tdData);
    this.registerListeners();

    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(
      atom.commands.add(this.element, {
        'core:close': () => {
          this.close();
        },
        'core:cancel': () => {
          this.close();
        }
      }));

  }


  update(props, children) {
    return etch.update(this);
  }

  initModels(tdData) {
    if (tdData['value']) {
      this.refs.tdValue.getModel().setText(tdData['value']);
    }

    ths.row = tdData['row'];
    ths.col = tdData['col'];
  }

  registerListeners() {
    //this.refs.btnConnect.addEventListener('click', () => this.connect());
    this.refs.btnClose.addEventListener('click', () => this.close());
    //this.refs.btnList.addEventListener('click', () => this.dbList());
  }

  render() {
    return (
      <section className='atom-psql-ui dialog'>
        <div className='heading section-heading'>TD</div>

        <section className="row row-centered">
          <label className='control-label'>value</label>
          <div className='row-item-flex'>
            <atom-text-editor ref='tdValue'
                              attributes={{tabindex: 0, mini: true, 'placeholder-text': 'localhost'}}></atom-text-editor>
          </div>
        </section>

        <div className='buttons'>
          <button tabindex='7' id="btnClose" className='btn btn-default btn-padding-left' ref='btnClose'>Close</button>
        </div>
      </section>
    );
  }

  show() {
    if (!this.dialogPanel) {
      this.dialogPanel = atom.workspace.addModalPanel({item: this.element});
    }
    //this.refs.dbName.focus();
  }

  close() {
    if (this.dialogPanel) {
      this.dialogPanel.hide();
      this.element.remove();
      this.dialogPanel.destroy();
      this.dialogPanel = null;
    }
  }


}


