"use babel";
/** @jsx etch.dom */

import etch, {getScheduler} from 'etch';
import {CompositeDisposable} from 'atom';
import {PsqlControler, PsqlErrorParser} from "./psql.js";
import {$, $$$} from 'atom-space-pen-views';

import Utils from './utils.js';
import DbConnectionConfig from './db-connection-config.js';

module.exports = class NewConnectionDialog {

  constructor(previouslyFocusedElement, connectionData, onConnect) {
    this.onConnectClicked = onConnect;
    this.previouslyFocusedElement = previouslyFocusedElement;

    this.state = {
      defaultPort: 5432,
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
    if (connectionData['password']) {
      this.refs.dbPassword.getModel().setText(connectionData['password']);
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
            <atom-text-editor ref='dbServer' attributes={{
              mini: true,
              tabindex: 4,
              'placeholder-text': 'localhost'
            }}></atom-text-editor>
          </div>
          <label className='control-port'>Port</label>
          <div className='row-item-flex'>
            <atom-text-editor ref='dbPort' attributes={{
              mini: true,
              tabindex: 5,
              'placeholder-text': this.state.defaultPort
            }}></atom-text-editor>
          </div>
        </section>

        <section className="row row-centered">
          <label className='control-label'>Auth</label>
          <div className='row-item-flex row-item-pad-right'>
            <atom-text-editor ref='dbUser'
                              attributes={{mini: true, tabindex: 6, 'placeholder-text': 'user'}}></atom-text-editor>
          </div>
          <div className='row-item-flex row-item-pad-left' style={"display:none;visibility:hidden"}>
            <atom-text-editor ref='dbPassword'
                              attributes={{mini: true, tabindex: 7, 'placeholder-text': 'password'}}></atom-text-editor>
          </div>
        </section>

        <section className="row row-centered">
          <label className='control-label'>Database</label>
          <div className='row-item-flex'>
            <atom-text-editor ref='dbName' attributes={{
              mini: true,
              tabindex: 8,
              'placeholder-text': 'database-name'
            }}></atom-text-editor>
          </div>
        </section>


        <div className='buttons'>
          <button tabindex='11' id="btnList" className='btn btn-default' ref='btnList' style="display:inline">List
            Databases
          </button>
          <button tabindex='10' id="btnConnect" className='btn btn-default' ref='btnConnect'>Connect</button>
          <button tabindex='12' id="btnClose" className='btn btn-default btn-padding-left' ref='btnClose'>Close</button>
        </div>

        <div id="dblist" className="dblist">
        </div>
      </section>
    );
  }

  show() {
    if (!this.dialogPanel){
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
    let dblistEl = $('#dblist');
    dblistEl.empty();
    let dbNameModel = this.refs.dbName.getModel();
    let psql = new PsqlControler({
      PGDATABASE: 'postgres',
      PGUSER: this.refs.dbUser.getModel().getText(),
      PGHOST: this.refs.dbServer.getModel().getText(),
      PGPORT: this.refs.dbPort.getModel().getText(),
    });

    let SQL = "SELECT d.datname FROM pg_catalog.pg_database d WHERE d.datname not like 'template%' ORDER BY 1;";
    let errorsHandler = function(count,errors,messges){
      if (count > 0){
        for (let msg of errors) {
          //console.log(msg);
          alert(msg);
        }
      }
    };

    let hander = function(record){
      let name = record[0];
      if (name &&  name.trim() != '') {
        let span = $('<span class="dbn">' + name + '</span>');
        //console.log(span);
        span.click(function(){
          dbNameModel.setText(name);
        });
        dblistEl.append(span);

      }
    }
    psql.processTuples(SQL,hander,null,errorsHandler);
  }

  connect() {

    var connectionData = {
      PGUSER: this.refs.dbUser.getModel().getText(),
      password: this.refs.dbPassword.getModel().getText(),
      PGHOST: this.refs.dbServer.getModel().getText(),
      PGDATABASE: this.refs.dbName.getModel().getText(),
    };

    if (this.refs.dbPort.getModel().getText() !== '') {
      connectionData['PGPORT'] = this.refs.dbPort.getModel().getText();
    }
    if (!connectionData.PGDATABASE) {
      alert('DATABASE NOT SET');
      return;
    }

    let psql = new PsqlControler(connectionData);
    if (!psql.testConnection()) {
      alert('CANNOT CONNECT TO DATABASE');
      return;
    }

    this.onConnectClicked(connectionData);
    this.close();
  }


}


