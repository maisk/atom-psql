'use babel';
import fs from 'fs';
import os from 'os';
import {$, $$$} from 'atom-space-pen-views';
import {CompositeDisposable} from 'atom';
import PsqlHtmlView from "./atom-psql-html-view";
import {PSQLRC, PSQL_EDITOR_CMD, PsqlControler, PsqlErrorParser} from "./psql.js";
import NewConnectionDialog from './new-connection-dialog';
import TerminalController from './terminal-controller';


const psqlErrorHandlerNotificationsWarning = function (counter, errors, messages) {
  let msg = null;
  if (counter == 1) {
    msg = '<b>1 ERROR FOUND</b>';
  } else {
    msg = '<b>' + counter + ' ERRORS FOUND</b>';
  }
  atom.notifications.addWarning(msg);
  for (let msg of errors) {
    atom.notifications.addWarning(msg);
  }
};


export default class AtomPsqlController {
  //newConnectionpreviouslyFocusedElement = null;
  newConnectionDialog = null;
  fifoItIntializedFlag = false;
  connectionActiveFlag = false;
  subscriptions = null;
  PGDATABASE = null;
  PGHOST = null;
  PGPORT = null;
  PGUSER = null;
  exec_counter = 0;
  terminalService = null;
  terminal = null;
  //terminalInitFlag = false;
  terminalInitialShell = null;
  setting_echo_on = true;

  constructor(state) {
    let unlinkErrHandler = (err) => {
      if (err) {
        atom.notifications.addError(JSON.stringify(err));
      }
    }
    if (fs.existsSync(PSQLRC)) {
      //console.log("UNLINK: " + PSQLRC);
      fs.unlink(PSQLRC, unlinkErrHandler);
    }
    if (fs.existsSync(PSQL_EDITOR_CMD)) {
      //console.log("UNLINK: " + PSQL_EDITOR_CMD);
      fs.unlink(PSQL_EDITOR_CMD, unlinkErrHandler);
    }


    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'atom-psql:run_selection_edit': () => this.exec_selection_sql('edit'),
      'atom-psql:run_selection_text': () => this.exec_selection_sql('text'),
      'atom-psql:run_selection_html': () => this.exec_selection_sql('html'),
      'atom-psql:run_selection_term': () => this.exec_selection_sql('term'),
      'atom-psql:new_connection'    : () => this.createNewConnection(),
      'atom-psql:db_info'    : () => this.db_info(),
      'atom-psql:toggle_echo': () => {
        this.setting_echo_on = !this.setting_echo_on;
        atom.notifications.addInfo("ATOM-PSQL ECHO IS: " + (this.setting_echo_on ? 'ON' : 'OFF'));
      },
      //'atom-psql:data_atom': () => this.data_atom()

    }));

    this.PGDATABASE = process.env['PGDATABASE'];
    this.PGHOST = process.env['PGHOST'];
    this.PGPORT = process.env['PGPORT'];
    this.PGUSER = process.env['PGUSER'];
    if (! this.PGHOST){
      this.PGHOST='127.0.0.1';
    }
    if (! this.PGPORT){
      this.PGPORT = '5432';
    }
    if (! this.PGUSER){
      this.PGUSER = os.userInfo().username;
    }

    let psql = new PsqlControler();
    if(this.PGDATABASE && !psql.testConnection()){
      this.PGDATABASE = null;
    }


    // if (atom.config.get('atom-psql.readFromNamedPipe')) {
    //   this.init_fifo();
    // } else {
    //   this.init_watch();
    // }
    //
    // this.init_db_metadata();
  }

  destroy() {
    //if (this.terminalInitialShell) {
    //atom.config.set('platformio-ide-terminal.core.shell', this.terminalInitialShell);
    //}
    this.subscriptions.dispose();
  }

  serialize() {
  }



  setTerminalService(terminalService) {
    this.terminal = new TerminalController(terminalService);
    //this.terminal.setTerminalService(terminalService);

  }


  init_fifo() {
    //console.log("NAMED PIPE");
    let fifo = '/tmp/atom-psql-fifo';
    if (fs.existsSync(fifo)) {
      fs.unlinkSync(fifo);
    }
    const cp = require('child_process');
    let result = cp.execSync('mkfifo ' + fifo);
    if (result && result[0]) {
      atom.notifications.addError(JSON.stringify(result));
    }
    const fd = fs.openSync(fifo, 'r+')
    const readable = fs.createReadStream(null, {fd});
    readable.setEncoding('utf8');
    readable.on('data', (d) => {
      if (editor = atom.workspace.getActiveTextEditor()) {
        editor.insertText(d);
      }
    });
  }


  init_watch() {
    //console.log("WATCH");
    let watch_file = '/tmp/atom-psql-fifo';
    if (fs.existsSync(watch_file)) {
      fs.unlinkSync(watch_file);
    }
    fs.closeSync(fs.openSync(watch_file, 'w'));

    fs.unwatchFile(watch_file);
    fs.watch(watch_file, (curr, prev) => {
      if (editor = atom.workspace.getActiveTextEditor()) {
        fs.readFile(watch_file, 'utf8', (err, data) => {
          if (err) {
            atom.notifications.addError(JSON.stringify(err));
          } else {
            editor.insertText(data);
          }
        });
      }
    });

  }

  exec_selection_sql(rtype,query,setting_echo_on) {
    if (!this.connectionActiveFlag) {
      this.createNewConnection();
      return;
    }

    if (setting_echo_on === undefined || setting_echo_on === null){
      setting_echo_on = this.setting_echo_on;
    }

    if (! query) {
      let editor;
      if (editor = atom.workspace.getActiveTextEditor()) {
        query = editor.getSelectedText();
      }
    }

    if (rtype == 'term') {
      // if (this.initTerminal()) {
      //   return;
      // }
      if (!query) {
        return;
      }
      this.terminal.sendText(query);
      return;
    }

    if (!query) {
      return;
    }

    // if (!this.PGDATABASE) {
    //   atom.notifications.addError('PGDATABASE IS NOT SET');
    //   return;
    // }

    if (rtype != 'edit') {
      this.exec_counter += 1;
    }
    if (!fs.existsSync('/tmp/atom-psql')) {
      fs.mkdirSync('/tmp/atom-psql');
    }

    if (!rtype) {
      rtype = 'html';
    }

    const cp = require('child_process');
    let max_sql_view = atom.config.get('atom-psql.maximumSqlViews') - 1;
    let sql_view_cnt = 0;
    let max_ordinal = 0;

    for (let pane of atom.workspace.getPanes()) {
      for (let item of pane.getItems()) {
        if (item.constructor.name == 'PsqlHtmlView') {
          sql_view_cnt += 1;
          let tmp = item.getOrdinal();
          if (tmp > max_ordinal) {
            max_ordinal = tmp;
          }
          if (sql_view_cnt > max_sql_view) {
            pane.destroyItem(item);
          }
        }
      }
    }

    let ordinal = max_ordinal + 1;

    let extension = (rtype == 'html') ? 'html' : 'txt';
    let exec_cnt = this.exec_counter;
    let title;
    if (ordinal == exec_cnt) {
      title = 'psql: ' + ordinal + ' ' + extension;
    } else {
      title = 'psql: ' + ordinal + '  (' + exec_cnt + ')  ' + extension;
    }
    let now = (new Date).getTime();
    let file_new = '/tmp/atom-psql/' + now + '.' + extension;

    let psql_args;
    // -a, --echo-all           echo all input from script
    // -e, --echo-queries       echo commands sent to server
    // -b, --echo-errors        echo failed commands
    if (rtype == 'html') {
      psql_args = '-b   --pset=format=html --pset=border=0';
      // } else if (rtype == 'text_echo_off') {
      //   psql_args = '-b';
    } else {
      psql_args = '-b';
    }
    if (setting_echo_on) {
      psql_args += ' -a -e';
    }
    let PSQL_REDIRECT_ARGS = '2>&1 >> ' + file_new + ' | tee --append ' + file_new;
    let PSQL_ARGS = psql_args;
    let psql = new PsqlControler({
      'PSQL_ARGS': PSQL_ARGS,
      'PSQL_REDIRECT_ARGS': PSQL_REDIRECT_ARGS,
    });
    psql.exec(query, (error, stdout, stderr) => {
      if (error != null) {
        atom.notifications.addError(JSON.stringify(error));
        return;
      }
      if (stdout) {
        //console.log(stdout);
        let errorHandler = new PsqlErrorParser(psqlErrorHandlerNotificationsWarning);
        errorHandler.processTextPsqlOutput(stdout);
      }

      if (stderr) {
        atom.notifications.addWarning(stderr);
      }

      let showPsqlResultHtml = function () {
        let htmlView = new PsqlHtmlView({'ordinal': ordinal, 'title': title, 'filePath': file_new});
        let ap = atom.workspace.getActivePane();
        let html_item = ap.addItem(htmlView);
        ap.activateItem(html_item);
      }
      let showPsqlResultTxt = function () {
        atom.workspace.open(file_new);
      }
      let showPsqlResultEdit = function () {
        let editor_new = atom.workspace.buildTextEditor({autoHeight: false});
        editor_new.insertText(fs.readFileSync(file_new, 'utf8'));
        let ap = atom.workspace.getActivePane();
        let new_item = ap.addItem(editor_new);
        ap.activateItem(new_item);
      }

      let showPsqlResult = (rtype == 'edit') ? showPsqlResultEdit : showPsqlResultHtml;
      //let showPsqlResult = (rtype == 'edit') ? showPsqlResultTxt : showPsqlResultHtml;

      const fileSizeInBytes = (fs.statSync(file_new)).size;
      const max_kb = atom.config.get('atom-psql.maximumSqlViewInKb');
      let max_bytes = max_kb * 1000;// 1000000;
      if (fileSizeInBytes > max_bytes) {
        atom.notifications.addWarning('PSQL RESULT TO BIG: ' + Math.floor(fileSizeInBytes / 1000) + ' MUST BE < ' + max_kb + ' Kb');
        fs.unlink(file_new, () => {
        });
      } else {
        showPsqlResult();
      }

    });

  }


  init_db_metadata() {
    if (! this.PGDATABASE){
      console.log("canot initialize pgdata");
      return;
    }
    //--CASE c.relkind WHEN 'r' THEN 'table' WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized view' WHEN 'i' THEN 'index' WHEN 'S' THEN 'sequence' WHEN 's' THEN 'special' WHEN 'f' THEN 'foreign table' END as "Type",
    let SQL_TABLES = `
    SELECT n.nspname as "Schema",
    c.relname as "Name",
    c.relkind
    FROM pg_catalog.pg_class c
    LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r','v')
    AND n.nspname <> 'pg_catalog'
    AND n.nspname <> 'information_schema'
    AND n.nspname !~ '^pg_toast'
    AND pg_catalog.pg_table_is_visible(c.oid)
    ORDER BY 1,2;`;

    let self = this;
    this.atomPsqlTables = [];
    let psql = new PsqlControler({});


    psql.processTuples(SQL_TABLES, (fields) => {
      let reltype = fields[2];
      let type = null;
      switch (reltype) {
        case 'v':
          type = 'View';
          break;
        case 'r':
          type = 'Table';
          break;
      }
      let rec = {'schemaName': fields[0], 'name': fields[1], 'type': type};
      // console.log(rec);
      self.atomPsqlTables.push(rec);
    }, psqlErrorHandlerNotificationsWarning);
  }

  // getPsqlCmd(psql_args) {
  //   var psql_cmd = atom.config.get('atom-psql.psqlCommand');
  //   return (psql_cmd + ' ' + psql_args + ' ' + this.PGDATABASE);
  // }


  db_info() {
    if (!this.PGDATABASE) {
      this.createNewConnection();
      return;
    }

    let SQL=`
      SELECT current_database();
      
      SELECT CURRENT_USER;

      \\echo SCHEMAS:
      \\dn+
      
      \\echo TABLES:
      \\dt+
      
      \\echo VIEWS:
      \\dv+

      \\echo FUNCTIONS:
      \\dfn

      \\echo WINDOW FUNCTIONS:
      \\dfw

      \\echo AGGRIGATE FUNCTIONS:
      \\dfa

      \\echo TRIGGERS:
      \\dft
    `;
     this.exec_selection_sql('html',SQL,false);

  }

  createNewConnection() {

    if (!this.terminal){
      let msg = "<b>platformio-ide-terminal package required</b>.<br/> Please install this package first:<br/> platformio-ide-terminal";
      atom.notifications.addError(msg,{dismissable:true});
      return;
    }

    connectionData = {
      'PGDATABASE':this.PGDATABASE,
      'PGUSER': (this.PGUSER ? this.PGUSER  : null),
      'PGHOST': (this.PGHOST ? this.PGHOST  : null),
      'PGPORT': (this.PGPORT ? this.PGPORT  : null),
    };

    let self = this;

    if (this.newConnectionDialog && this.newConnectionDialog['dialogPanel']){
      console.log(this.newConnectionDialog);
      this.newConnectionDialog.close();
      return;
    }

    let newConnectionpreviouslyFocusedElement =  $(':focus');

    this.newConnectionDialog = new NewConnectionDialog(newConnectionpreviouslyFocusedElement, connectionData , (connectionData) => {
      //console.log(connectionData);
      if (connectionData['PGDATABASE']){
        process.env['PGDATABASE'] = connectionData['PGDATABASE'];
        this.PGDATABASE = connectionData['PGDATABASE'];
      }
      if (connectionData['PGHOST']){
        process.env['PGHOST'] = connectionData['PGHOST'];
        this.PGHOST = connectionData['PGHOST'];
      }

      if (connectionData['PGOPORT']){
        process.env['PGPORT'] = connectionData['PGPORT'];
        this.PGPORT = connectionData['PGPORT'];
      }
      if (connectionData['PGUSER']){
        process.env['PGUSER'] = connectionData['PGUSER'];
        this.PGUSER = connectionData['PGUSER'];
      }

      if (! this.fifoItIntializedFlag) {
        if (atom.config.get('atom-psql.readFromNamedPipe')) {
          this.init_fifo();
        } else {
          this.init_watch();
        }
      }
      self.init_db_metadata();
      self.terminal.init({
        'restoreFocus':true,
        'restoreFocusElement' : newConnectionpreviouslyFocusedElement,
        'clean':true,
      });
      self.connectionActiveFlag = true;
    });
    this.newConnectionDialog.show();
  }

}

