'use babel';
import fs from 'fs';
import os from 'os';
import {$} from 'atom-space-pen-views';
import {CompositeDisposable, Emitter, Point, Range, GrammarRegistry} from 'atom';
import PsqlHtmlView from "./atom-psql-html-view";
import {
  PSQL_EDITOR_CMD,
  psqlCommandControllerInstance,
  PsqlController,
  PsqlErrorParser,
  PSQLRC
} from "./psql.js";
import NewConnectionDialog from './new-connection-dialog';
import {TERMINAL_PSQL_CMD, TERMINAL_TAB_URI, TerminalController} from './terminal-controller';
import {ATOMPSQL_ERRORS_FILE, AtomPsqlWatch} from './atom-psql-watch';
import {PsqlQueryParserLine} from './psql-query-parser-line';
import Utils from './utils.js';
import {RELATION_VIEW_URI, SELECT_VIEW_URI, AtomPsqlRelationView} from './rel-view';
import {DB_VIEW_URI, AtomPsqlDBView} from './db-view';


class TransactionManager {
  state = 0;
  //0 non active
  //1 active
  //2 broken


  constructor() {
    this.emitter = new Emitter();
  }

  onDidStateChanged(callback) {
    return this.emitter.on('did-state-changed', callback);
  }


  stateToString(state) {
    if (state == 0) {
      return "inactive";
    } else if (state == 1) {
      return "active";
    } else if (state == 2) {
      return "broken";
    } else {
      return "unknown";
    }
  }

  getState() {
    return this.state;
  }

  setState(state) {
    this.state = state;
    this.emitter.emit('did-state-changed', this.state);
  }

  reset() {
    if (this.state != 0) {
      this.state = 0;
      this.emitter.emit('did-state-changed', this.state);
    }
  }

  begin() {
    if (this.state == 0) {
      this.state = 1;
      this.emitter.emit('did-state-changed', this.state);
      return true;
    } else {
      return true;
    }
  }

  commit() {
    if (this.state == 0) {
      return false;
    } else if (this.state == 1 || this.state == 2) {
      this.state = 0;
      this.emitter.emit('did-state-changed', this.state);
      return true;
    }
    return false;
  }

  rollback() {
    if (this.state != 0) {
      this.state = 0;
      this.emitter.emit('did-state-changed', this.state);
    }
  }

  error() {
    if (this.state == 1) {
      this.state = 2;
      this.emitter.emit('did-state-changed', this.state);
    }
  }
}

const transactionManager = new TransactionManager();

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
  serviceInitFlag = false;
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
  /**
   *
   * @type TerminalController
   */
  terminal = null;
  setting_echo_on = true;
  toolBar = null;
  toolBarInitFlag = false;
  psqlColumns = [];

  constructor(state) {
    let self = this;
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

    if (fs.existsSync(ATOMPSQL_ERRORS_FILE)) {
      fs.unlink(ATOMPSQL_ERRORS_FILE, unlinkErrHandler);
    }
    fs.closeSync(fs.openSync(ATOMPSQL_ERRORS_FILE, 'w'));


    this.setting_echo_on = atom.config.get('atom-psql.psql.echoQueries');
    this.terminal = new TerminalController();

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
      'atom-psql:edit_query_results': () => this.edit_query_results(),
      'atom-psql:toggle_psql': () => this.toggle_psql(),
      'atom-psql:transaction_state': () => this.transaction_state(),
      'atom-psql:db_view': () => this.db_view(),

      'atom-psql:toggle_echo': () => {
        this.setting_echo_on = !this.setting_echo_on;
        atom.notifications.addInfo("ATOM-PSQL ECHO IS: " + (this.setting_echo_on ? 'ON' : 'OFF'));
      },
      'atom-psql:send_rollback': () => {
        if (!this.serviceInitFlag) {
          atom.notifications.addWarning("psql is not ready action aborted");
          this.initServices();
          return;
        }
        transactionManager.rollback();
        this.exec_selection_sql('term', 'ROLLBACK;', false);
      },
      'atom-psql:send_begin': () => {
        if (!this.serviceInitFlag) {
          atom.notifications.addWarning("psql is not ready action aborted");
          this.initServices();
          return;
        }
        transactionManager.begin();
        this.exec_selection_sql('term', 'BEGIN;', false);
      },
      'atom-psql:send_commit': () => {
        if (!this.serviceInitFlag) {
          atom.notifications.addWarning("psql is not ready action aborted");
          this.initServices();
          return;
        }
        transactionManager.commit();
        this.exec_selection_sql('term', 'COMMIT;', false);
      },
      'atom-psql:show_terminal_erors': () => {
        let errors_found = false;
        if (fs.existsSync(ATOMPSQL_ERRORS_FILE)) {
          const fileSizeInBytes = (fs.statSync(ATOMPSQL_ERRORS_FILE)).size;
          if (fileSizeInBytes > 0) {
            errors_found = true;
            atom.workspace.open(ATOMPSQL_ERRORS_FILE).then((editor) => {
              editor.moveToBottom();
            });
          }
        }
        if (!errors_found) {
          atom.notifications.addInfo('No psql Errors Found');
        }
      },

      'atom-psql:refresh-variables': () => {
        if (this.terminal.psqlTerminalView.isReadyForCommand()) {
          this.terminal.updatePsqlVariableView();
        } else {
          atom.notifications.addWarning("terminal is not ready");
        }
      },

      'atom-psql:clear-variables': () => {
        if (this.terminal.psqlTerminalView.isReadyForCommand()) {
          this.terminal.clearPsqlVariableView();
        } else {
          atom.notifications.addWarning("terminal is not ready");
        }
      },


      'atom-psql:updateVariablesProvider': () => {
        //console.log("UPDATE PROVIDER");
        if (this.terminal.variablesView) {
          let variables = this.terminal.variablesView.getVariables();
          this.psqlColumns = [];
          for (let k in variables) {
            this.psqlColumns.push({name: k, type: ''});
          }
        }
      },
      'atom-psql:clear_terminal': () => {
        this.terminal.clear();
      },


        'atom-psql:select_head': () => {
      let selected_text = '';
      let editor = atom.workspace.getActiveTextEditor();
      if (editor) {
        if (selection = editor.getSelectedText()) {
          selected_text = selection;
        }
      }
      let uri = SELECT_VIEW_URI + '/' + selected_text;
      atom.workspace.open(uri);
    },

      'atom-psql:send_slash_d': () => {
        let selected_text = '';
        let editor = atom.workspace.getActiveTextEditor();
        if (editor) {
          if (selection = editor.getSelectedText()) {
            selected_text = selection;
          }
        }
        let uri = RELATION_VIEW_URI + '/' + selected_text;
        atom.workspace.open(uri);
      },

    }));


    this.subscriptions.add(atom.workspace.addOpener((uri) => {
      if (uri == DB_VIEW_URI) {
        return (new AtomPsqlDBView(self));
      }
      if (uri.startsWith(RELATION_VIEW_URI)) {
        let relation = uri.substring(RELATION_VIEW_URI.length + 1);
        return (new AtomPsqlRelationView(self, relation, 1));
      }
      if (uri.startsWith(SELECT_VIEW_URI)) {
        let relation = uri.substring(SELECT_VIEW_URI.length + 1);
        return (new AtomPsqlRelationView(self, relation, 2));
      }

    }));


    // this.subscriptions.add(atom.workspace.addOpener((uri) => {
    //   console.log(">>",uri);
    //  if (uri === TERMINAL_TAB_URI) {
    //   let terminalView =  this.terminal.openFromUri();
    //   console.log(terminalView);
    //   return terminalView;
    //  }
    // }));


    // {label: 'Cut',
    //     command: 'core:cut',
    // }, {
    //   label: 'Paste',
    //     command: 'core:paste',    }


    let commandController = psqlCommandControllerInstance;
    // this.subscriptions.add(commandController.onDidGset(() => {
    //   atom.notifications.addInfo("GSET");
    // }));
    this.subscriptions.add(commandController.onDidBegin(() => {
      //atom.notifications.addInfo("BEGIN");
      transactionManager.begin();
    }));
    this.subscriptions.add(commandController.onDidCommit(() => {
      //atom.notifications.addInfo("COMMIT");
      transactionManager.commit();
    }));
    this.subscriptions.add(commandController.onDidRollback(() => {
      //atom.notifications.addInfo("ROLLBACK");
      transactionManager.rollback();
    }));
    this.subscriptions.add(commandController.onDidConnect(() => {
      atom.notifications.addWarning('instead "\\c" USE Connection Dialog in order to connect', {dismissable: true});
    }));
    this.subscriptions.add(commandController.onDidError(({message, detail}) => {
      transactionManager.error();
      atom.notifications.addError(message, {dismissable: true, detail: detail});
    }));


    this.subscriptions.add(transactionManager.onDidStateChanged((state) => {
      let stateTxt = transactionManager.stateToString(state);
      let btn = $("[data-original-title='show transaction state']");
      //btn.removeClass('fa-eye');
      btn.text(stateTxt);
      if (state == 1) {
        btn.css('color', 'green');
      } else if (state == 2) {
        btn.css('color', 'red');
      } else {
        btn.css('color', 'orange');
        //btn.css('color','inherit');
        //btn.css('color','#ff00ff');
      }
      atom.notifications.addInfo('TRANSACTION STATE:' + stateTxt);
    }));


    atom.contextMenu.add({
      'atom-text-editor': [
        {
          label: 'psql: \d+  [selection]',
          command: 'atom-psql:send_slash_d',
          'shouldDisplay': function (event) {
            if (self.connectionActiveFlag) {
              return true;
            }
            return false;
          }
        },
        {
          label: 'SELECT * FROM [selection] limit 20',
          command: 'atom-psql:select_head',
          'shouldDisplay': function (event) {
            if (self.connectionActiveFlag) {
              return true;
            }
            return false;
          }
        },
      ]
    });


    this.PGDATABASE = process.env['PGDATABASE'];
    this.PGHOST = process.env['PGHOST'];
    this.PGPORT = process.env['PGPORT'];
    this.PGUSER = process.env['PGUSER'];
    //if (!this.PGHOST) {
    //this.PGHOST = '127.0.0.1';
    //}
    // if (!this.PGPORT) {
    //   this.PGPORT = '5432';
    //   process.env['PGUSER'] = this.PGPORT;
    // }

    if (!this.PGUSER) {
      this.PGUSER = os.userInfo().username;
      process.env['PGUSER'] = this.PGUSER;
    }


    if (atom.config.get('atom-psql.core.conectOnStart')) {
      if (this.PGDATABASE != null) {
        let psql = new PsqlController({'PGPASS': this.PGPASS});
        let rep = psql.testConnection(true);
        if (rep && rep['result']) {
          this.initConnection();
        } else {
          console.log(rep);
        }
      }
    }

  }

  destroy() {
    this.terminal.close();
    this.subscriptions.dispose();
  }

  serialize() {
  }


  transaction_state() {
    let state = transactionManager.getState();
    let opts = {
      'dismissable': true,
      'buttons': [
        {
          text: 'close', onDidClick: function (ev) {
          this.getModel().dismiss();
        }
        },

        {
          text: 'clear state', onDidClick: function (ev) {
          transactionManager.reset();
          this.getModel().dismiss();
        }
        },

        {
          text: 'set active', onDidClick: function (ev) {
          transactionManager.setState(1);
          this.getModel().dismiss();
        }
        },

        {
          text: 'set broken', onDidClick: function (ev) {
          transactionManager.setState(2);
          this.getModel().dismiss();
        }
        },
      ]
    };
    atom.notifications.addInfo('TRANSACTION STATE:' + transactionManager.stateToString(state), opts);
  }


  db_view() {
    if (!this.connectionActiveFlag) {
      atom.notifications.addInfo('you are not connected');
      return;
    }

    let self = this;

    let initFlag = false;
    if (!this.dbView) {
      initFlag = true;
    } else if (!this.dbView.liveFlag) {
      initFlag = true;
      //se periptosi pou exi afere8i apo to xristi to item apo to pane
      this.dbView.close();
    }

    if (!initFlag) {
      setTimeout(() => {
        if (self.dbView) {
          let pane = atom.workspace.paneForItem(self.dbView);
          if (pane) {
            pane.activateItem(self.dbView);
          }
        }
      });
      return;
    }

    this.dbView = new AtomPsqlDBView(this);
    atom.workspace.open(this.dbView, {
      location: 'bottom',
      activatePane: 'true',
      activateItem: 'true',
      //'split': 'right',
    });


//       let psql = new PsqlController({
//         PGPASS: this.PGPASS
//       });
//
//       //WHERE c.relkind IN ('r','v','m')
//       let SQL1 =`
// SELECT n.nspname as "Schema",
// c.relname as "Name",
// c.relkind,
// pg_catalog.pg_get_userbyid(c.relowner) as "Owner"
// FROM pg_catalog.pg_class c
// LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
// WHERE c.relkind IN ('r')
// AND n.nspname <> 'pg_catalog'
// AND n.nspname <> 'information_schema'
// AND n.nspname !~ '^pg_toast'
// AND pg_catalog.pg_table_is_visible(c.oid)
// ORDER BY 1,2;
// `;
//
//
//       let errorsHandler = function(error,txt){
//         let msg = '';
//         if (error != null){
//           msg += 'error: ' + error +"<br/>\n";
//         }
//         msg += txt;
//         atom.notifications.addError(msg);
//       }
//
//       let recordHandler = function(record){
//         console.log(record);
//       }
//       let finHandler = function(count){
//         console.log('finish',count);
//       }
//
//       psql.processTuples(SQL1,recordHandler,finHandler,errorsHandler);
//


  }

  toggle_psql() {
    let self = this;
    //console.log("toggle_psql");
    if (!self.connectionActiveFlag) {
      //console.log("toggle_psql#1");
      self.createNewConnection();
      return;
    }
    if (!self.serviceInitFlag) {
      //console.log("toggle_psql#2");
      self.initServices();
      return;
    }
    //console.log("toggle_psql#4");
    self.terminal.toggle();
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

    tb.addButton({
      icon: "postgresql-plain",
      iconset: "devicon",
      callback: 'atom-psql:toggle_psql',
      tooltip: 'psql',
    });


    tb.addSpacer();

    //"shift-enter": "atom-psql:querySelection",
    tb.addButton({
      icon: "paint-brush",
      iconset: "fa",
      callback: 'atom-psql:querySelection',
      tooltip: 'select command next to cursor'
    });


    tb.addButton({
      icon: "terminal",
      iconset: "fa",
      callback: 'atom-psql:run_selection_term',
      tooltip: 'send command to terminal'
    });

    tb.addSpacer();

    tb.addButton({
      icon: "bug",
      iconset: "fa",
      callback: 'atom-psql:show_terminal_erors',
      tooltip: 'Show psql terminal errors'
    });
    tb.addButton({
      icon: "eraser",
      iconset: "fa",
      callback: 'atom-psql:clear_terminal',
      tooltip: 'Clear terminal'
    });


    tb.addSpacer();

    ////////////////////////////////////////////////////////////////////////////
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

    tb.addButton({
      icon: "volume-up",
      iconset: "fa",
      callback: 'atom-psql:toggle_echo',
      tooltip: 'Toggle Echo SQL'
    });

    ////////////////////////////////////////////////////////////////////////////
    tb.addSpacer();
    tb.addButton({
      // icon: "play",
      // iconset: "fi",
      icon: "play-circle-o",
      iconset: "fa",
      callback: 'atom-psql:send_begin',
      tooltip: 'send BEGIN to terminal'
    });

    let button_commit = tb.addButton({
      //icon: "record",
      //iconset: "fi",
      icon: "dot-circle-o",
      iconset: "fa",
      callback: 'atom-psql:send_commit',
      tooltip: 'send COMMIT to terminal'
    });

    let button_rollback = tb.addButton({
      // icon: "previous",
      // iconset: "fi",
      icon: "undo",
      iconset: "fa",
      callback: 'atom-psql:send_rollback',
      tooltip: 'send ROLLBACK to terminal'
    });
    tb.addSpacer();
    let button_state = tb.addButton({
      //icon: "eye",
      //iconset: "fa",
      callback: 'atom-psql:transaction_state',
      tooltip: 'show transaction state'
    });
    let btn;
    // btn = $("[data-original-title*='send BEGIN to terminal']");
    // btn.removeClass('fa-play-circle-o');
    // btn.text('begin');
    // btn = $("[data-original-title*='send COMMIT to terminal']");
    // btn.removeClass('fa-dot-circle-o');
    // btn.text('commit');
    // btn = $("[data-original-title*='send ROLLBACK to terminal']");
    // btn.removeClass('fa-fast-backward');
    // btn.text('rollback');

    btn = $("[data-original-title*='show transaction state']");
    let w = Math.floor(btn.width() * 1.5);
    //btn.removeClass('fa-eye');
    btn.width(w);
    // btn.text('inactive');
    tb.addSpacer();
    ////////////////////////////////////////////////////////////////////////////


    tb.addButton({
      icon: "info",
      iconset: "fa",
      callback: 'atom-psql:connection_info',
      tooltip: 'Connection Info'
    });

    tb.addButton({
      icon: "table",
      iconset: "fa",
      callback: 'atom-psql:db_view',
      tooltip: 'Database Info'
    });


  }


  connection_info(type) {
    if (type == 'info') {
      if (!this.connectionActiveFlag) {
        atom.notifications.addInfo('you are not connected');
        return;
      }
      this.initServices();
      if (this.terminal.isReadyForCommand()) {
        this.exec_selection_sql('term', '\\conninfo', false);
      }
    }
    let psql = new PsqlController({PGPASS: this.PGPASS});
    psql.execRaw('\\conninfo', (error, stdout, stderr) => {

      if (error || stderr) {
        atom.notifications.addError(stderr);
      } else {
        let det = '';
        let conninfo = psql.parseConnInfo(stdout);
        if (conninfo) {
          if (this.PGHOST) {
            if (conninfo['PGHOST'] != this.PGHOST) {
              atom.notifications.addError('WRONG HOST: ' + conninfo['PGHOST'] + ' != ' + this.PGHOST);
            }
          }
          if (this.PGPORT) {
            if (conninfo['PGPORT'] != this.PGPORT) {
              atom.notifications.addError('WRONG PORT: ' + conninfo['PGPORT'] + ' != ' + this.PGPORT);
            }
          }
          if (conninfo['PGUSER'] != this.PGUSER) {
            atom.notifications.addError('WRONG USER: ' + conninfo['PGUSER'] + ' != ' + this.PGUSER);
          }
          if (conninfo['PGDATABASE'] != this.PGDATABASE) {
            atom.notifications.addError('WRONG DATABASE: ' + conninfo['PGDATABASE'] + ' != ' + this.PGDATABASE);
          }
          det += 'TYPE:     ' + conninfo['TYPE'] + "\n";
          det += 'HOST:     ' + ((conninfo['PGHOST']) ? conninfo['PGHOST'] : '') + "\n";
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

          opts['buttons'] = [{
            text: 'close', onDidClick: function (ev) {
              this.removeNotification();
            }
          }];
          atom.notifications.addSuccess(msg, opts);

        }
      }
    });
  }


  edit_query_results() {
    let results = atom.workspace.getActivePaneItem();
    if (!results) {
      return;
    }
    if (!results['filePath']) {
      return;
    }
    let fp = results['filePath'];
    let type = results['fileType'];
    let ext = type == 'html' ? 'html' : 'txt';
    let now = (new Date).getTime();
    let nfp = '/tmp/' + now + '.' + ext;
    fs.renameSync(fp, nfp);
    atom.workspace.open(nfp);
    results.destroy();
  }

  //returnType
  //1 text
  //2 queries array of text
  //3 range
  getQueryFromEditor(returnType) {
    returnType = (returnType == undefined) ? 1 : returnType;
    let queryParser = new PsqlQueryParserLine();
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

          return queryParser.getQueriesExtend();
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
      let lastCursor = editor.getCursorBufferPosition();
      let range = new Range(new Point(initCursor.row, 0), lastCursor);
      editor.setSelectedScreenRange(range);
      setTimeout(function () {
        editor.setCursorScreenPosition(lastCursor);
      }, 50);
      return queryParser.getQueriesExtend();
    }
    return null;
  }

  editorMoveToNextLine() {
    if (!(editor = atom.workspace.getActiveTextEditor())) {
      return;
    }
    let c = 0;
    while (c < 40) {
      c += 1;
      cursor = editor.getCursorBufferPosition();
      if (!cursor) {
        console.log("no cursor");
        return;
      }
      let row = cursor.row;
      let line = editor.lineTextForBufferRow(row);
      if (line.match(/^\s*$/)) {
        editor.moveDown(1);
        if ((editor.getCursorBufferPosition()).row == row) {//EOF
          //EOF
          break;
        }
      } else {
        break;
      }
    }

  }

  querySelection() {
    let editor;
    if (!(editor = atom.workspace.getActiveTextEditor())) {
      return;
    }

    this.editorMoveToNextLine();

    if (selection = editor.getSelectedText()) {
      let line = editor.moveDown(1);
      this.editorMoveToNextLine();
    }
    let range = this.getQueryFromEditor(3);
    if (range) {
      editor.setSelectedScreenRange(range);
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
      if (!this.serviceInitFlag) {
        this.initServices();
        return;
      }

      this.terminal.activate();

      if (query) {
        //TODO: pass this from command controller
        this.terminal.sendText(query);
        return;
      }
      let queries = this.getQueryFromEditor(2);
      if (!queries) {
        return;
      }
      let self = this;
      let gsetFlag = false;
      if (queries.length == 1) {
        let cmd = queries[0];
        let checks = psqlCommandControllerInstance.checkCommand(cmd);
        gsetFlag = Utils.checkCommandReplyHasGset(checks);
        this.terminal.sendText(cmd['q']);
        if (gsetFlag) {
          this.terminal.updatePsqlVariableView();
        }
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
              let checks = psqlCommandControllerInstance.checkCommand(q);
              if (!gsetFlag) {
                gsetFlag = Utils.checkCommandReplyHasGset(checks);
              }
              self.terminal.sendText(q['q']);
            } else {
              const endMs = (new Date).getTime();
              if ((endMs - startMs) > 1000) {
                atom.notifications.addSuccess('terminal transfer finish');
              }
              clearInterval(intervalId);
              if (gsetFlag) {
                console.log("GET PSQL VARIABLES");
                this.terminal.updatePsqlVariableView();
                //this.terminal.getPsqlVariables(psqlVariablesCallback);
              }
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
      psql_args += ' --pset=format=html --pset=border=0 -T \'class="psqltable"\'';
    }
    // else if (rtype == 'text'){
    //    query = "\\pset border 2\n" + query;
    //  }
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
    psql.execRaw(query, (error, stdout, stderr) => {
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
      // if(!setting_echo_on){
      //   const fileSizeInBytes = (fs.statSync(err_file)).size;
      // }


      let showPsqlResultHtml = function () {
        let htmlView = new PsqlHtmlView({
          'ordinal': ordinal,
          'title': title,
          'filePath': file_new,
          'fileType': rtype
        });
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
      //console.log("fileSizeInBytes>>",file_new,fileSizeInBytes);
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
    //--AND pg_catalog.pg_table_is_visible(c.oid)
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
    ORDER BY 1,2;`;

    SQL_DB = "select current_database()";


    let self = this;
    this.atomPsqlTables = [];
    let psql = new PsqlController({'PGPASS': this.PGPASS});


    psql.processTuples(SQL_DB, (record) => {
      self.metadata_db = record[0];
    });


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
      //console.log(rec.schemaName, rec.name);
      self.atomPsqlTables.push(rec);
    });


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


  initConnection() {
    let self = this;
    if (!self.fifoItIntializedFlag) {
      let watch = new AtomPsqlWatch();
      watch.init();
    }
    self.init_db_metadata();
    self.connection_info('success');
    self.connectionActiveFlag = true;
    transactionManager.reset();
  }

  initServices(forceTerminalInit, focusedElement) {
    //console.log("INIT SERVICES");
    let self = this;
    if (focusedElement == undefined) {
      focusedElement = null;
    }
    if (forceTerminalInit == undefined) {
      forceTerminalInit = false;
    }
    if (!this.serviceInitFlag || forceTerminalInit) {
      let terminal_init_opts = {
        'PGPASS': self.PGPASS,
        'restoreFocus': true,
        'clean': true,
        'name': this.PGDATABASE
      };
      if (focusedElement) {
        terminal_init_opts['restoreFocusElement'] = focusedElement;
      }
      self.terminal.init(terminal_init_opts);
    }
    this.serviceInitFlag = true;
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
      this.initConnection();
      this.initServices(true, newConnectionpreviouslyFocusedElement);

    });
    this.newConnectionDialog.show();
  }


  keymaps_help() {
    //&#160;&#160;&#34;ctrl-enter&#34;: &#34;atom-psql:run_selection_term&#34;<br/><br/>
    atom.notifications.addInfo(`Not mandatory action<br/>Please add these to your keymap.cson (Menu: Edit->Keymap..) In order to control your keymaps:<br/><hr/>
                                   &#34;atom-workspace atom-text-editor&#34;:<br/>
                                   &#160;&#160;&#34;shift-enter&#34;: &#34;atom-psql:querySelection&#34;,<br/>
                                   &#160;&#160;&#34;ctrl-enter&#34;: &#34;atom-psql:run_selection_term&#34;,<br/>
                                   &#160;&#160;&#34;f5&#34;: &#34;atom-psql:run_selection_term&#34;,<br/>
                                   &#160;&#160;&#34;f6&#34;: &#34;atom-psql:run_selection_html&#34;,<br/>
                                   &#160;&#160;&#34;f7&#34;: &#34;atom-psql:run_selection_text&#34;,<br/>
                                   &#160;&#160;&#34;f8&#34;: &#34;atom-psql:run_selection_edit&#34;,<br/>
                                   &#160;&#160;&#34;f9&#34;: &#34;atom-psql:new_connection&#34;<br/>
                                   &#34;atom-workspace&#34;:<br/>
                                   &#160;&#160;&#34;ctrl-\`&#34;: &#34;atom-psql:toggle_psql&#34;<br/>
                                   <hr/>
                                   this dialog is available on menu: Packages -> atom-psql -> Keymaps Help<br/>
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
"atom-workspace":
    "ctrl-\`": "atom-psql:toggle_psql"
`
            );
          }
          }]
      }
    );

  }


}
