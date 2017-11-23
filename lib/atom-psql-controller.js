'use babel';
import fs from 'fs';
import os from 'os';
import {$, $$$} from 'atom-space-pen-views';
import {CompositeDisposable, Point, Range} from 'atom';
import PsqlHtmlView from "./atom-psql-html-view";
import {PSQLRC, PSQL_EDITOR_CMD, PsqlController, PsqlErrorParser, PsqlQueryParser} from "./psql.js";
import NewConnectionDialog from './new-connection-dialog';
import {TERMINAL_PSQL_CMD, TerminalController} from './terminal-controller';
import ApmController from './apm.js';
import AtomPsqlWatch from './atom-psql-watch.js';
//import utils from './utils';


const psqlErrorHandlerNotificationsWarning = function (counter, errors, warnings, messages) {
  let msg = null;
  if (counter > 0) {
    if (counter == 1) {
      msg = '<b>1 ERROR FOUND</b>';
    } else {
      msg = '<b>' + counter + ' ERRORS FOUND</b>';
    }
    atom.notifications.addError(msg, {dismissable: true});
    for (let msg of errors) {
      atom.notifications.addError(msg, {dismissable: true});
    }
  }
  for (let msg of warnings) {
    atom.notifications.addWarning(msg);
  }

  for (let msg of messages) {
    atom.notifications.addInfo(msg);
  }


};


export default class AtomPsqlController {
  newConnectionDialog = null;
  fifoItIntializedFlag = false;
  connectionActiveFlag = false;
  subscriptions = null;
  PGDATABASE = null;
  PGHOST = null;
  PGPORT = null;
  PGUSER = null;
  PGPASS = null;
  exec_counter = 0;
  terminalService = null;
  terminal = null;
  //terminalInitFlag = false;
  terminalInitialShell = null;
  setting_echo_on = true;
  toolBar = null;
  toolBarInitFlag = false;

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
    if (fs.existsSync(TERMINAL_PSQL_CMD)) {
      //console.log("UNLINK: " + TERMINAL_PSQL_CMD);
      fs.unlink(TERMINAL_PSQL_CMD, unlinkErrHandler);
    }


    this.setting_echo_on = atom.config.get('atom-psql.psql.echoQueries');

    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'atom-psql:run_selection_edit': () => this.exec_selection_sql('edit'),
      'atom-psql:run_selection_text': () => this.exec_selection_sql('text'),
      'atom-psql:run_selection_html': () => this.exec_selection_sql('html'),
      'atom-psql:run_selection_term': () => this.exec_selection_sql('term'),
      'atom-psql:querySelection': () => this.querySelection(),
      'atom-psql:new_connection': () => this.createNewConnection(),
      'atom-psql:db_info': () => this.db_info(),
      'atom-psql:keymaps_help': () => this.keymaps_help(),
      'atom-psql:connection_info': () => this.connection_info('info'),
      'atom-psql:toggle_echo': () => {
        this.setting_echo_on = !this.setting_echo_on;
        atom.notifications.addInfo("ATOM-PSQL ECHO IS: " + (this.setting_echo_on ? 'ON' : 'OFF'));
      },
      'atom-psql:send_rollback': () => {
        this.exec_selection_sql('term', 'ROLLBACK;', false);
      },
      'atom-psql:send_begin': () => {
        this.exec_selection_sql('term', 'BEGIN;', false);
      },
      'atom-psql:send_commit': () => {
        this.exec_selection_sql('term', 'COMMIT;', false);
      }

    }));

    this.PGDATABASE = process.env['PGDATABASE'];
    this.PGHOST = process.env['PGHOST'];
    this.PGPORT = process.env['PGPORT'];
    this.PGUSER = process.env['PGUSER'];
    if (!this.PGHOST) {
      this.PGHOST = '127.0.0.1';
    }
    if (!this.PGPORT) {
      this.PGPORT = '5432';
    }
    if (!this.PGUSER) {
      this.PGUSER = os.userInfo().username;
    }

    let psql = new PsqlController({'PGPASS': this.PGPASS});

  }

  destroy() {
    if (this.toolBar) {
      this.toolBar.removeItems();
      this.toolBar = null;
    }
    this.subscriptions.dispose();
  }

  serialize() {
  }


  setToolBar(toolBar) {
    this.toolBar = toolBar;
    if (atom.config.get('atom-psql.toolbar.initToolbarOnStart')) {
      this.setupToolbar();
    }
  }

  setupToolbar() {
    if (!atom.config.get('atom-psql.toolbar.displayToolbar')) {
      return;
    }
    console.log("#3");

    if (this.toolBarInitFlag) {
      return;
    }
    this.toolBarInitFlag = true;
    let self = this;
    let tb = this.toolBar;
    // "command": "atom-psql:new_connection"
    // "command": "atom-psql:connection_info"
    // "command": "atom-psql:keymaps_help"
    // "command": "atom-psql:db_info"
    // "command": "atom-psql:toggle_echo"
    // "command": "atom-psql:run_selection_term"
    // "command": "atom-psql:run_selection_text"
    // "command": "atom-psql:run_selection_html"
    // "command": "atom-psql:run_selection_edit"

    tb.addButton({
      icon: "database",
      iconset: "fa",
      callback: 'atom-psql:new_connection',
      tooltip: 'New Connection',
    });

    tb.addSpacer();

    tb.addButton({
      icon: "terminal",
      iconset: "fa",
      callback: 'atom-psql:run_selection_term',
      tooltip: 'send command to terminal'
    });

    tb.addButton({
      icon: "html5",
      iconset: "fa",
      callback: 'atom-psql:run_selection_html',
      tooltip: 'query results on html'
    });

    tb.addButton({
      icon: "file-text",
      iconset: "fa",
      callback: 'atom-psql:run_selection_text',
      tooltip: 'query results on text'
    });
    tb.addButton({
      icon: "paragraph",
      iconset: "fa",
      callback: 'atom-psql:run_selection_edit',
      tooltip: 'query results on editor'
    });

    tb.addSpacer();

    tb.addButton({
      icon: "play",
      iconset: "fi",
      callback: 'atom-psql:send_begin',
      tooltip: 'send BEGIN to terminal'
    });

    let button_commit = tb.addButton({
      icon: "record",
      iconset: "fi",
      callback: 'atom-psql:send_commit',
      tooltip: 'send COMMIT to terminal'
    });

    let button_rollback = tb.addButton({
      icon: "previous",
      iconset: "fi",
      callback: 'atom-psql:send_rollback',
      tooltip: 'send ROLLBACK to terminal'
    });

    tb.addSpacer();

    tb.addButton({
      icon: "info",
      iconset: "fa",
      callback: 'atom-psql:connection_info',
      tooltip: 'Connection Info'
    });


  }

  setTerminalService(terminalService) {
    this.terminal = new TerminalController(terminalService);
  }


  connection_info(type) {
    if (type == 'info') {
      if (!this.connectionActiveFlag) {
        atom.notifications.addInfo('you are not connected');
        return;
      }
      this.exec_selection_sql('term', '\\conninfo', false);
    }
    let psql = new PsqlController({PGPASS: this.PGPASS});
    psql.exec('\\conninfo', (error, stdout, stderr) => {

      if (error || stderr) {
        atom.notifications.addError(stderr);
      } else {
        let det = '';
        let conninfo = psql.parseConnInfo(stdout);
        if (conninfo) {
          if (conninfo['PGHOST'] != this.PGHOST) {
            atom.notifications.addError('WRONG HOST: ' + conninfo['PGHOST'] + ' != ' + this.PGHOST);
          }
          if (conninfo['PGPORT'] != this.PGPORT) {
            atom.notifications.addError('WRONG PORT: ' + conninfo['PGPORT'] + ' != ' + this.PGPORT);
          }
          if (conninfo['PGUSER'] != this.PGUSER) {
            atom.notifications.addError('WRONG USER: ' + conninfo['PGUSER'] + ' != ' + this.PGUSER);
          }
          if (conninfo['PGDATABASE'] != this.PGDATABASE) {
            atom.notifications.addError('WRONG DATABASE: ' + conninfo['PGDATABASE'] + ' != ' + this.PGDATABASE);
          }
          det += 'HOST:     ' + conninfo['PGHOST'] + "\n";
          det += 'PORT:     ' + conninfo['PGPORT'] + "\n";
          det += 'USER:     ' + conninfo['PGUSER'] + "\n";
          det += 'DATABASE: ' + conninfo['PGDATABASE'] + "\n";
        } else {
          atom.notifications.addError('Canot Verify connection parameters');
        }
        let msg = stdout.replace("\n", "<br/>");

        let opts = {};
        if (det != '') {
          opts['detail'] = det;
        }
        if (type === undefined || type == 'info') {
          opts['dismissable'] = true;
          opts['buttons'] = [{
            text: 'close', onDidClick: function (ev) {
              this.getModel().dismiss()
            }
          }];
          atom.notifications.addInfo(msg, opts);
        } else {
          atom.notifications.addSuccess(msg, opts);
        }
      }
    });
  }

  //returnType
  //1 text
  //2 queries array of text
  //3 range
  getQueryFromEditor(returnType) {
    returnType = (returnType == undefined) ? 1 : returnType;
    let queryParser = new PsqlQueryParser();
    let selection;
    let editor = atom.workspace.getActiveTextEditor();
    if (!editor) {
      return;
    }
    if (selection = editor.getSelectedText()) {
      //"RETURN FROM SELECTION"
      if (returnType == 3) {
        return editor.getSelectedScreenRange();
      } else {
        queryParser.addText(selection);
        if (returnType == 2) {
          return queryParser.getQueries();
        }
        return queryParser.getText();
      }
    }
    //RETURN FROM LINE
    let initCursor = editor.getCursorBufferPosition();
    let selectionText = '';
    let cursor, pr;
    let current_row = null;
    let c = 0;
    while (c < 30) {
      c += 1;
      cursor = editor.getCursorBufferPosition();
      if (!cursor) {
        break;
      }
      let row = cursor.row;
      if (current_row && row == current_row) {
        break;
      }
      line = editor.lineTextForBufferRow(row);
      pr = queryParser.addLine(line);
      if (pr > 0) {
        if (pr == 1) {
          editor.moveDown(1);
          return null;
        }
        break;
      }
      editor.moveDown(1);
    }
    if (returnType == 3) {
      editor.moveToEndOfLine();
      let lastCursor = editor.getCursorBufferPosition();
      return new Range(new Point(initCursor.row, 0), lastCursor);
    }
    editor.moveDown(1);
    editor.moveToFirstCharacterOfLine();

    if (returnType == 1) {
      selectionText = queryParser.getText();
      selectionText = selectionText ? selectionText.trim() : null;
      if (selectionText) {
        return selectionText + "\n";
      }
    } else {
      return queryParser.getQueries();
    }
    return null;
  }

  querySelection() {
    let editor;
    if (editor = atom.workspace.getActiveTextEditor()) {
      let range = this.getQueryFromEditor(3);
      if (range) {
        editor.setSelectedScreenRange(range);
      }
    }
  }

  exec_selection_sql(rtype, query, setting_echo_on) {
    if (!this.connectionActiveFlag) {
      this.createNewConnection();
      return;
    }

    if (setting_echo_on === undefined || setting_echo_on === null) {
      setting_echo_on = this.setting_echo_on;
    }

    if (rtype == 'term') {
      if (!this.terminal) {
        return
      }
      if (query) {
        this.terminal.sendText(query);
        return;
      }
      let queries = this.getQueryFromEditor(2);
      if (!queries) {
        return;
      }
      if (queries.length == 1) {
        this.terminal.sendText(queries[0]);
      } else if (queries.length > 1) {

        let transferDelay = atom.config.get('atom-psql.psql.terminalInsertDelay');
        if (transferDelay < 200) {
          transferDelay = 200;
        }
        //console.log("TD",transferDelay);
        const startMs = (new Date).getTime();
        let self = this;
        let intervalId = setInterval(() => {
          try {
            let q = queries.shift();
            if (q) {
              self.terminal.sendText(q);
            } else {
              const endMs = (new Date).getTime();
              if ((endMs - startMs) > 1000) {
                atom.notifications.addSuccess('terminal transfer finish');
              }
              clearInterval(intervalId);
            }
          } catch (err) {
            console.log(err);
          }
        }, transferDelay);
      }
      return;
    }

    if (!query) {
      query = this.getQueryFromEditor();
    }
    if (!query) {
      return;
    }
    if (rtype != 'edit') {
      this.exec_counter += 1;
    }
    if (!fs.existsSync('/tmp/atom-psql')) {
      fs.mkdirSync('/tmp/atom-psql');
    }

    if (!rtype) {
      rtype = 'html';
    }

    let max_sql_view = atom.config.get('atom-psql.views.maximumSqlViews') - 1;
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

    let psql_args = '';
    // -a, --echo-all           echo all input from script
    // -e, --echo-queries       echo commands sent to server
    // -b, --echo-errors        echo failed commands
    // if (atom.config.get('atom-psql.psql.echoFailedCommands')) {
    //   //psql_args += ' -b';
    // }
    if (setting_echo_on) {
      psql_args += ' -e ';
    } else {
      psql_args += ' -b ';
    }
    if (rtype == 'html') {
      psql_args += ' --pset=format=html --pset=border=0';
    }
    //let PSQL_REDIRECT_ARGS = '2>&1 >> ' + file_new + ' | tee --append ' + file_new;
    let PSQL_REDIRECT_ARGS = null;
    if (setting_echo_on) {
      PSQL_REDIRECT_ARGS = '> ' + file_new + ' 2>&1';
    } else {
      PSQL_REDIRECT_ARGS = '> ' + file_new + ' 2> /tmp/atom-psql-errors';
    }

    let PSQL_ARGS = psql_args;
    let psql = new PsqlController({
      'PGPASS': this.PGPASS,
      'PSQL_ARGS': PSQL_ARGS,
      'PSQL_REDIRECT_ARGS': PSQL_REDIRECT_ARGS,
    });
    psql.exec(query, (error, stdout, stderr) => {
      if (error != null) {
        atom.notifications.addError(JSON.stringify(error));
        return;
      }
      if (stdout) {
        let errorHandler = new PsqlErrorParser(psqlErrorHandlerNotificationsWarning);
        errorHandler.processTextPsqlOutput(stdout);
      }
      if (stderr) {
        atom.notifications.addWarning(stderr);
      }

      let err_file = (setting_echo_on) ? file_new : '/tmp/atom-psql-errors';

      let lineByLine = require('n-readlines');
      let liner = new lineByLine(err_file);
      let line;
      let errorHandler = new PsqlErrorParser(psqlErrorHandlerNotificationsWarning);
      let lc = 0;
      while (lc < 20000 && (line = liner.next())) {
        errorHandler.processLine(line.toString('utf8'));
        lc += 1;
      }
      errorHandler.handleErrors();


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
      const max_kb = atom.config.get('atom-psql.views.maximumSqlViewInKb');
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
    if (!this.PGDATABASE) {
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
    let psql = new PsqlController({'PGPASS': this.PGPASS});


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
    }, null, psqlErrorHandlerNotificationsWarning);
  }


  db_info() {
    if (!this.PGDATABASE) {
      this.createNewConnection();
      return;
    }

    //SELECT current_database() as DATABASE, CURRENT_USER as USER;

    let SQL = `
       \\conninfo 
      \\echo 
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
    this.exec_selection_sql('html', SQL, false);

  }

  createNewConnection() {
    if (!atom.packages.hasActivatedInitialPackages()) {
      return;
    }
    let self = this;


    //package Dependencies
    ///////////////////////////////////////////////////
    // const terminalDepPackage = 'platformio-ide-terminal';
    // const toolbarDepPackage ='atom-toolbar';
    // // let afterInstall = function () {
    // //   self.keymaps_help();
    // //   atom.config.set('atom-psql.displayKeymapsInfoOnStart',false);
    // // };//apm.apmInstall({name: terminalDepPackage, onSuccess: afterInstall});
    //
    // let installFlag = false;
    // if (!this.terminal && !atom.packages.isPackageActive(terminalDepPackage)) {
    //   let apm = new ApmController();
    //   apm.apmInstall({name: terminalDepPackage});
    //   installFlag = true;
    // }
    // if (!atom.packages.isPackageActive(toolbarDepPackage)) {
    //   let apm = new ApmController();
    //   apm.apmInstall({name: toolbarDepPackage});
    //   installFlag = true;
    // }
    // if (installFlag){
    //   return;
    // }
    //////////////////


    if (atom.config.get('atom-psql.displayKeymapsInfoOnStart')) {
      atom.config.set('atom-psql.displayKeymapsInfoOnStart', false);
      self.keymaps_help();
      return;
    }

    connectionData = {
      'PGDATABASE': this.PGDATABASE,
      'PGUSER': (this.PGUSER ? this.PGUSER : null),
      'PGHOST': (this.PGHOST ? this.PGHOST : null),
      'PGPORT': (this.PGPORT ? this.PGPORT : null),
      'PGPASS': (this.PGPASS ? this.PGPASS : null),
    };


    if (this.newConnectionDialog && this.newConnectionDialog['dialogPanel']) {
      console.log(this.newConnectionDialog);
      this.newConnectionDialog.close();
      return;
    }

    let newConnectionpreviouslyFocusedElement = $(':focus');

    this.newConnectionDialog = new NewConnectionDialog(newConnectionpreviouslyFocusedElement, connectionData, (connectionData) => {
      self.setupToolbar();
      if (connectionData['PGDATABASE']) {
        process.env['PGDATABASE'] = connectionData['PGDATABASE'];
        self.PGDATABASE = connectionData['PGDATABASE'];
      }
      if (connectionData['PGHOST']) {
        process.env['PGHOST'] = connectionData['PGHOST'];
        self.PGHOST = connectionData['PGHOST'];
      }

      if (connectionData['PGPORT']) {
        process.env['PGPORT'] = connectionData['PGPORT'];
        self.PGPORT = connectionData['PGPORT'];
      }
      if (connectionData['PGUSER']) {
        process.env['PGUSER'] = connectionData['PGUSER'];
        self.PGUSER = connectionData['PGUSER'];
      }
      if (connectionData['PGPASS']) {
        self.PGPASS = connectionData['PGPASS'];
      }


      if (!self.fifoItIntializedFlag) {
        let watch = new AtomPsqlWatch();
        watch.init();
        // if (atom.config.get('atom-psql.psql.readFromNamedPipe')) {
        //   self.init_fifo();
        // } else {
        //   self.init_watch();
        // }
      }
      self.init_db_metadata();
      self.terminal.init({
        'PGPASS': self.PGPASS,
        'restoreFocus': true,
        'restoreFocusElement': newConnectionpreviouslyFocusedElement,
        'clean': true,
        'name': this.PGDATABASE
      });
      self.connection_info('success');
      self.connectionActiveFlag = true;
    });
    this.newConnectionDialog.show();
  }


  keymaps_help() {
    //&#160;&#160;&#34;ctrl-enter&#34;: &#34;atom-psql:run_selection_term&#34;<br/><br/>
    atom.notifications.addInfo(`Please add these to your keymap.cson (Menu: Edit->Keymap..) In order to control your keymaps:<br/><hr/>
                                   &#34;atom-workspace atom-text-editor&#34;:<br/>
                                   &#160;&#160;&#34;shift-enter&#34;: &#34;atom-psql:querySelection&#34;,<br/>
                                   &#160;&#160;&#34;ctrl-enter&#34;: &#34;atom-psql:run_selection_term&#34;,<br/>
                                   &#160;&#160;&#34;f5&#34;: &#34;atom-psql:run_selection_term&#34;,<br/>
                                   &#160;&#160;&#34;f6&#34;: &#34;atom-psql:run_selection_html&#34;,<br/>
                                   &#160;&#160;&#34;f7&#34;: &#34;atom-psql:run_selection_text&#34;,<br/>
                                   &#160;&#160;&#34;f8&#34;: &#34;atom-psql:run_selection_edit&#34;,<br/>
                                   &#160;&#160;&#34;f9&#34;: &#34;atom-psql:new_connection&#34;<br/><hr/>
                                   this dialog is available on menu: Packages -> atom-psql -> Keymaps Help
                                   
                                    `, {
        dismissable: true, buttons: [{
          text: 'close', onDidClick: function (ev) {
            this.getModel().dismiss()
          }
        },
          {
            text: 'copy to clipboard', onDidClick: function (ev) {
            atom.clipboard.write(`
"atom-workspace atom-text-editor":
  "shift-enter": "atom-psql:querySelection",
  "ctrl-enter": "atom-psql:run_selection_term",
  "f5": "atom-psql:run_selection_term",
  "f6": "atom-psql:run_selection_html",
  "f7": "atom-psql:run_selection_text",
  "f8": "atom-psql:run_selection_edit",
  "f9": "atom-psql:new_connection"
`
            );
          }
          }]
      }
    );

  }

}
