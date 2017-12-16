"use babel";
/** @jsx etch.dom */

import etch, {getScheduler} from 'etch';
import {CompositeDisposable} from 'atom';
import {PsqlController, PsqlErrorParser} from "./psql.js";
import {$, $$$} from 'atom-space-pen-views';

import Utils from './utils.js';
import DbConnectionConfig from './db-connection-config.js';

class MessageArea {
  id = null;
  rootEl = null;
  className = null;

  constructor(id, className) {
    this.id = '#' + id;
    if (!className) {
      className = id;
    }
    this.className = className;
    this.rootEl = $(this.id);
    this.rootEl.attr('class', className);
    this.rootEl.empty();
  }

  clear(timeout) {
    let self = this;
    let clearFn = function () {
      let el = $(self.id);
      if (el.attr('class') == self.className) {
        el.empty();
      }
    }
    if (timeout) {
      setTimeout(clearFn, timeout);
    } else {
      clearFn();
    }
  }

  appendElement(el) {
    this.rootEl.append(el);
  }

}


module.exports = class NewConnectionDialog {

  constructor(previouslyFocusedElement, connectionData, onConnect) {
    this.onConnectClicked = onConnect;
    this.previouslyFocusedElement = previouslyFocusedElement;

    this.state = {
    };

    this.focusButtonFlag = (connectionData['PGDATABASE']) ? true : false;


    etch.initialize(this);
    this.initModels(connectionData);
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

  initModels(connectionData) {
    if (connectionData['PGUSER']) {
      this.refs.dbUser.getModel().setText(connectionData['PGUSER']);
    }
    if (connectionData['PGPASS']) {
      this.refs.dbPassword.getModel().setText(connectionData['PGPASS']);
    }
    if (connectionData['PGHOST']) {
      this.refs.dbServer.getModel().setText(connectionData['PGHOST']);
    }
    if (connectionData['PGDATABASE']) {
      this.refs.dbName.getModel().setText(connectionData['PGDATABASE']);
    }
    if (connectionData['PGPORT']) {
      this.refs.dbPort.getModel().setText(connectionData['PGPORT']);
    }
  }

  registerListeners() {
    this.refs.btnConnect.addEventListener('click', () => this.connect());
    this.refs.btnClose.addEventListener('click', () => this.close());
    this.refs.btnList.addEventListener('click', () => this.dbList());
  }

  //refs
  //connectionName
  //connections
  //url
  //dbType
  //dbOptions
  //btnSaveConnect
  render() {
    return (
      <section className='atom-psql-ui dialog'>
        <div className='heading section-heading'>New Connection...</div>


        <section className="row row-centered">
          <label className='control-label'>Server</label>
          <div className='row-item-flex'>
            <atom-text-editor ref='dbServer'
                              attributes={{tabindex: 0, mini: true, 'placeholder-text': 'localhost'}}></atom-text-editor>
          </div>
          <label className='control-port'>Port</label>
          <div className='row-item-flex'>
            <atom-text-editor ref='dbPort'
                              attributes={{tabindex: 1, mini: true, 'placeholder-text': '5432'}}></atom-text-editor>
          </div>
        </section>

        <section className="row row-centered">
          <label className='control-label'>Auth</label>
          <div className='row-item-flex row-item-pad-right'>
            <atom-text-editor ref='dbUser'
                              attributes={{mini: true, tabindex: 2, 'placeholder-text': 'user'}}></atom-text-editor>
          </div>
          <div className='row-item-flex row-item-pad-left'>
            <atom-text-editor ref='dbPassword'
                              attributes={{mini: true, tabindex: 3, 'placeholder-text': 'password'}}></atom-text-editor>
          </div>
        </section>

        <section className="row row-centered">
          <label className='control-label'>Database</label>
          <div className='row-item-flex'>
            <atom-text-editor ref='dbName' attributes={{
              mini: true,
              tabindex: 4,
              'placeholder-text': 'database-name'
            }}></atom-text-editor>
          </div>
        </section>


        <div className='buttons'>
          <button tabindex='5' id="btnList" className='btn btn-default' ref='btnList' style="display:inline">List
            Databases
          </button>
          <button tabindex='6' id="btnConnect" className='btn btn-default' ref='btnConnect'>Connect</button>
          <button tabindex='7' id="btnClose" className='btn btn-default btn-padding-left' ref='btnClose'>Close</button>
        </div>

        <div id="dblist"></div>
        <div id="errors"></div>
      </section>
    );
  }

  show() {
    if (!this.dialogPanel) {
      this.dialogPanel = atom.workspace.addModalPanel({item: this.element});
    }
    // if (this.focusButtonFlag) {
    //   this.refs.btnConnect.focus();
    // } else {
    this.refs.dbName.focus();
//    }
  }

  close() {
    if (this.dialogPanel) {
      this.dialogPanel.hide();
      this.element.remove();
      this.dialogPanel.destroy();
      this.dialogPanel = null;
      if (this.previouslyFocusedElement) {
        this.previouslyFocusedElement.focus();
      }
    }
  }

  dbList() {
    let dbList = new MessageArea('dblist');
    // let dblistEl = $('#dblist');
    // dblistEl.empty();
    let dbNameModel = this.refs.dbName.getModel();
    let psql = new PsqlController({
      PGDATABASE: 'postgres',
      PGUSER: this.refs.dbUser.getModel().getText(),
      PGHOST: this.refs.dbServer.getModel().getText(),
      PGPORT: this.refs.dbPort.getModel().getText(),
      PGPASS: this.refs.dbPassword.getModel().getText(),
    });

    let SQL = "SELECT d.datname FROM pg_catalog.pg_database d WHERE d.datname not like 'template%' ORDER BY 1;";
    let errorsHandler = function (count, errors, warnings, messges) {
      if (count > 0) {
        let ma = new MessageArea('errors');
        for (let msg of errors) {
          let error_span = $('<span class="err_msg">');
          error_span.text(msg);
          ma.appendElement(error_span);
          ma.clear(6000);
        }
      }
    };

    let hander = function (record) {
      let name = record[0];
      if (name && name.trim() != '') {
        let span = $('<span class="dbn">');
        span.text(name);
        span.click(function () {
          dbNameModel.setText(name);
        });
        //dblistEl.append(span);
        dbList.appendElement(span);

      }
    }
    psql.processTuplesAndErrors(SQL, hander, null, errorsHandler);
  }

  connect() {

    var connectionData = {
      PGUSER: this.refs.dbUser.getModel().getText(),
      PGPASS: this.refs.dbPassword.getModel().getText(),
      PGHOST: this.refs.dbServer.getModel().getText(),
      PGPORT: this.refs.dbPort.getModel().getText(),
      PGDATABASE: this.refs.dbName.getModel().getText(),
    };


    let errorHandler = function (error_msg) {
      let ma = new MessageArea('errors');
      let error_span = $('<span class="err_msg">');
      error_span.text(error_msg);
      ma.appendElement(error_span);
      ma.clear(6000);
    }
    if (!connectionData.PGDATABASE) {
      errorHandler('Database not set');
      return;
    }

    let psql = new PsqlController(connectionData);
    let ct = psql.testConnection(false);
    if (!ct.result) {
      errorHandler(ct.msg);
      return;
    }

    this.onConnectClicked(connectionData);
    this.close();
  }


}


