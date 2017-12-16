'use babel';
import fs from 'fs';
import {$, $$$} from 'atom-space-pen-views';
import {Emitter} from 'atom'

export const PSQLRC = '/tmp/.atom-psqlrc';
export const PSQL_EDITOR_CMD = '/tmp/.atom-psqledit';


export class PsqlController {

  PSQLRC_DATA = `

--from atom-psql
\\set QUIET 1
\\setenv LESS '-KFSXimx4 --shift 16'
\\set bash         '\\\\! bash -l'
\\set pager_less   '\\\\setenv PAGER less'
\\set pager_more   '\\\\setenv PAGER more'
\\set pager_on  '\\\\pset pager on'
\\set pager_off  '\\\\pset pager off'
\\set e '\\\\w /tmp/atom-psql-fifo'
\\set atom_capture_start '\\\\o /tmp/atom-psql-fifo'
\\set atom_capture_stop  '\\\\o'
\\set help '\\\\echo pager_more | pager_less | pager_on | pager_off \\\\echo bash \\\\echo atom_capture_start atom_capture_stop'
\\setenv PAGER less
\\pset pager on

`;

  PSQL_EDITOR_DATA = `
#!/bin/bash 
cat $1  > /tmp/atom-psql-fifo;
exit 1;
`;


  //ENV VARS
  PGDATABASE = null;
  PGHOST = null;
  PGPORT = null;
  PGUSER = null;
  COLUMNS = null;
  PAGER = null;
  PSQL_EDITOR = null;
  PSQLRC = null;
  //EDITOR
  //VISUAL
  //PSQL_EDITOR_LINENUMBER_ARG
  //PSQL_HISTORY
  //SHELL
  //TMPDIR
  PSQL_ARGS = null;
  PSQL_BIN = null;
  PSQL_REDIRECT_ARGS = null;
  PGPASS = null;

  DEFAULT_ERROR_HANDLER = function (error, txt) {
    let msg = 'psql error';
    if (error != null) {
      msg += (':' + error + "<br/>\n");
    }
    atom.notifications.addError(msg, {dismissable: true, detail: txt});
  };

  DEFAULT_ERROR_HANDLER_NOT_DISMISSABLE = function (error, txt) {
    let msg = 'psql error';
    if (error != null) {
      msg += (':' + error + "<br/>\n");
    }
    atom.notifications.addError(msg, {
      dismissable: false,
      detail: txt,
      'buttons': [{
        text: 'close', onDidClick: function (ev) {
          this.removeNotification();
        }
      }],
    });
  };

  constructor(options) {
    if (!options) {
      options = {};
    }
    this.PGDATABASE = options['PGDATABASE'] ? options['PGDATABASE'] : process.env['PGDATABASE'];
    this.PGHOST = options['PGHOST'] ? options['PGHOST'] : process.env['PGHOST'];
    this.PGPORT = options['PGPORT'] ? options['PGPORT'] : process.env['PGPORT'];
    this.PGUSER = options['PGUSER'] ? options['PGUSER'] : process.env['PGUSER'];
    this.COLUMNS = options['COLUMNS'] ? options['COLUMNS'] : null;
    this.PSQL_ARGS = options['PSQL_ARGS'] ? options['PSQL_ARGS'] : '';
    this.PSQL_REDIRECT_ARGS = options['PSQL_REDIRECT_ARGS'] ? options['PSQL_REDIRECT_ARGS'] : '';
    this.PGPASS = options['PGPASS'] ? options['PGPASS'] : null;
    this.PSQL_BIN = atom.config.get('atom-psql.psql.psqlCommand');

  }

  //PRIVATE
  initPSQL() {
    if (!fs.existsSync(PSQL_EDITOR_CMD)) {
      fs.writeFileSync(PSQL_EDITOR_CMD, this.PSQL_EDITOR_DATA);
      fs.chmodSync(PSQL_EDITOR_CMD, '755');
    }
    if (!fs.existsSync(PSQLRC)) {
      let HOME = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
      let init_psqlrc = HOME + '/.atom-psqlrc';
      if (fs.existsSync(init_psqlrc)) {
        const fse = require('fs-extra');
        fse.copySync(init_psqlrc, PSQLRC);
      } else {
        //console.log(init_psqlrc + " NOT FOUND")
        fs.closeSync(fs.openSync(PSQLRC, 'w'));
      }

      let append_Data = this.PSQLRC_DATA;
      append_Data += ("\\set PROMPT1 '" + atom.config.get('atom-psql.psql.PROMPT1') + "'\n");
      append_Data += ("\\set PROMPT2 '" + atom.config.get('atom-psql.psql.PROMPT2') + "'\n");
      append_Data += ("\\set PROMPT3 '" + atom.config.get('atom-psql.psql.PROMPT3') + "'\n");
      append_Data += "\\set QUIET 0\n";
      append_Data += "--\n";
      fs.appendFileSync(PSQLRC, append_Data);
    }
  }


  getEnvBase() {
    return {
      'PSQLRC': PSQLRC,
      'LESS': '-KFSXimx4 --shift 16',
      'PSQL_EDITOR': PSQL_EDITOR_CMD,
    };

  }

  getENV() {
    let ENV = this.getEnvBase();
    if (this.PGDATABASE) {
      ENV['PGDATABASE'] = this.PGDATABASE;
    }
    if (this.PGHOST) {
      ENV['PGHOST'] = this.PGHOST;
    }
    if (this.PGPORT) {
      ENV['PGPORT'] = this.PGPORT;
    }
    if (this.PGUSER) {
      ENV['PGUSER'] = this.PGUSER;
    }
    if (this.COLUMNS) {
      ENV['COLUMNS'] = this.COLUMNS;
    }
    return ENV;
  }


  getExecOptions() {
    return {'env': this.getENV()};
  }

  getPSQL_CONN_URL() {
    let server = '';
    let server_sep = '';
    if (this.PGHOST) {
      server += (server_sep + this.PGHOST);
      server_sep = ':';
    }
    if (this.PGPORT) {
      server += (server_sep + this.PGPORT);
    }


    get_params = '';
    get_params_sep = '?';
    if (this.PGUSER) {
      get_params += (get_params_sep + 'user=' + encodeURIComponent(this.PGUSER));
      get_params_sep = '&';
    }
    if (this.PGPASS) {
      get_params += (get_params_sep + 'password=' + encodeURIComponent(this.PGPASS));
    }

    let conn_url = 'postgresql://' + server + '/' + this.PGDATABASE + get_params;
    console.log(conn_url);
    return conn_url;
  }

  getPSQL_ARGS() {
    if (this.PGPASS) {
      return (this.PSQL_ARGS + ' "' + this.getPSQL_CONN_URL() + '" ' + this.PSQL_REDIRECT_ARGS);
    }
    return (this.PSQL_ARGS + ' ' + this.PSQL_REDIRECT_ARGS);
  }

  getPSQLCMD() {
    let args = this.getPSQL_ARGS();
    let psql_cmd = this.PSQL_BIN + ' ' + args;
    //console.log(psql_cmd);
    return psql_cmd;
  }


  parseConnInfo(conninfoStr) {

    //You are connected to database "test" as user "kostas" on host "127.0.0.1" at port "5432".
    //You are connected to database "test" as user "kostas" via socket in "/var/run/postgresql" at port "5432".
    let match;
    let regexp, connType;
    if (conninfoStr.match("via socket in")) {
      connType = 'socket';
      regexp = new RegExp(/^[\s|\w]+"(\w+)"[\.|\s|\w]+"([\.\w]+)"[\s|\w]+"([\.\w\/]+)"[\s|\w]+"([\.\w]+)"/);
    } else {
      connType = 'host';
      regexp = new RegExp(/^[\s|\w]+"(\w+)"[\.|\s|\w]+"([\.\w]+)"[\s|\w]+"([\.\w]+)"[\s|\w]+"([\.\w]+)"/);
    }
    match = conninfoStr.match(regexp);
    if (match && match.length >= 5) {
      let host = (connType == 'host') ? match[3] : null;
      return {
        TYPE: connType,
        PGDATABASE: match[1],
        PGUSER: match[2],
        PGHOST: host,
        PGPORT: match[4],
      }
    }
    return null;
  }

  testConnection(verifyFlag) {
    if (verifyFlag === undefined) {
      verifyFlag = true;
    }
    this.initPSQL();
    this.PSQL_ARGS = '-t -A';
    let ENV = this.getENV();
    let psql_cmd = this.getPSQLCMD();
    let options = this.getExecOptions();
    const cp = require('child_process');
    const SQL = '\\conninfo';
    options.input = SQL;
    try {
      let txt = cp.execSync(psql_cmd, options);
      if (verifyFlag) {
        if (!txt) {
          return {result: false, msg: 'response'};
        }
        txt = txt.toString('utf8');
        let conninfo = this.parseConnInfo(txt);
        if (conninfo['PGUSER'] != this.PGUSER) {
          return {result: false, msg: 'PGUSER'};
        }
        if (this.PGHOST) {
          if (conninfo['PGHOST'] != this.PGHOST) {
            return {result: false, msg: 'PGHOST'};
          }
        }
        if (this.PGPORT) {
          if (conninfo['PGPORT'] != this.PGPORT) {
            return {result: false, msg: 'PGPORT'};
          }
        }
        if (conninfo['PGDATABASE'] != this.PGDATABASE) {
          return {result: false, msg: 'PGDATABASE'};
        }
      }
      return {result: true};
    } catch (err) {
      return {result: false, msg: err}
    }
  }


  // execSync(SQL) {
  //   this.initPSQL();
  //   let psql_cmd = this.getPSQLCMD();
  //   console.log(psql_cmd);
  //
  //   const cp = require('child_process');
  //   let rep= cp.spawnSync(psql_cmd,[], {
  //     input: SQL,
  //   });
  //   return rep;
  // }



  exec(SQL, callback_stdout,options) {
    if (!options){
      options = {};
    }

    let error_handler = this.DEFAULT_ERROR_HANDLER;
    if (options['error_handler']){
      error_handler = options[error_handler];
    } else if (options['error_dismisable'] !== undefined){
        error_handler = options['error_dismisable'] ? this.DEFAULT_ERROR_HANDLER : this.DEFAULT_ERROR_HANDLER_NOT_DISMISSABLE;
    }
    if (options['after_error_handling']){
      let after_cb = options['after_error_handling'];
      let error_handler_org = error_handler;
      error_handler = function (error, txt) {
        error_handler_org(error,txt);
        after_cb(error,txt);
      }
    }

    let prev_psql_args = null;
    if (options['psql_args']) {
     prev_psql_args = this.PSQL_ARGS;
     if (!this.PSQL_ARGS){
       this.PSQL_ARGS = '';
     }
     this.PSQL_ARGS += options['psql_args'];

    }

    let callback = function(error,stdout,stderr){
      if (error || (stderr && stderr != '')){
        error_handler(error,stderr);
        return;
      }
      callback_stdout(stdout);
    };


    this.execRaw(SQL,callback);
    if (prev_psql_args){
      this.PSQL_ARGS =prev_psql_args;
    }
  }


  execRaw(SQL, callback) {
    this.initPSQL();
    let psql_cmd = this.getPSQLCMD();
    let options = this.getExecOptions();
    const cp = require('child_process');
    //console.log(psql_cmd);
    let process = cp.exec(psql_cmd, options, callback);
    process.stdin.write(SQL);
    process.stdin.end();
    return process;
  }



  execPromiseRaw(SQL) {
    let self = this;
    return new Promise((resolve, reject) => {
      self.execRaw(SQL, (error, stdout, stderr) => {
        if (error != null) {
          reject(error, stdout, stderr);
          return;
        }
        resolve(stdout, stderr);
      });
    });
  }

  processTuplesAndErrors(SQL, callbackRecord, callbackFinish, errorsHandler) {
    // this.PSQL_ARGS = " -t -A -0 -F\"\x01\" ";
    // return this.exec(SQL, (error, stdout, stderr) => {
    //   if (error != null) {
    //     errorsHandler(1, [stderr], []);
    //     return;
    //   }
    //   if (stderr) {
    //     errorParser.processTextPsqlOutput(stderr);
    //     return;
    //   }
    //   let lines = stdout.split("\x00");
    //   for (let line of lines) {
    //     let fields = line.split("\x01");
    //     callbackRecord(fields);
    //   }
    //   if (callbackFinish) {
    //     callbackFinish();
    //   }
    // });

    let errorParser = new PsqlErrorParser(errorsHandler);
    this.processTuples(SQL, callbackRecord, callbackFinish, function (error, stderr) {
      if (error != null) {
        errorsHandler(1, [stderr], []);
      } else {
        errorParser.processTextPsqlOutput(stderr);
      }
    });
  }


  processTuples(SQL, callbackRecord, callbackFinish, errorHandler) {
    this.PSQL_ARGS = " -t -A -0 -F\"\x01\" ";
    if (!errorHandler) {
      errorHandler = this.DEFAULT_ERROR_HANDLER;
    }
    return this.execRaw(SQL, (error, stdout, stderr) => {
      if (error != null) {
        errorHandler(error, stderr);
        return;
      }
      if (stderr) {
        errorHandler(null, stderr);
        return;
      }
      let c = 0;
      let lines = stdout.split("\x00");
      for (let line of lines) {
        if (line == '') {
          continue;
        }
        c += 1;
        let fields = line.split("\x01");
        callbackRecord(fields);
      }
      if (callbackFinish) {
        callbackFinish(c);
      }
    });
  }


  // execToFile(SQL,rtype, outputFile, callback){
  //   let psql_args;
  //   if (rtype == 'html') {
  //     psql_args = '-a -b -e  --pset=format=html --pset=border=0';
  //   } else if (rtype == 'text_echo_off') {
  //     psql_args = '-b';
  //   } else {
  //     psql_args = '-a -b -e';
  //   }
  //   this.PSQL_REDIRECT_ARGS = '2>&1 >> ' + outputFile + ' | tee --append ' + outputFile;
  //   this.PSQL_ARGS = psql_args;
  //
  //   return this.exec(SQL,callback);
  // }


}

export class PsqlErrorParser {

  warnings = [];
  messages = [];
  errors = [];
  error_counter = 0;
  warning_counter = 0;
  messages_counter = 0;
  error_handler;

  constructor(error_handler) {
    if (error_handler) {
      this.error_handler = error_handler;
    } else {
      this.error_handler = (error_counter, errors, messages, text) => {
        console.log("PSQL ERROR  COUNTER: ", error_counter);
        console.log("PSQL ERRORS: ", errors);
        console.log("PSQL MESSAGES: ", messages);
        console.log("PSQL ERRROS TEXT: ", text);
      }
    }
  }

  processTextPsqlOutput(txtOut) {
    //console.log(txtOut);
    for (let line of txtOut.split("\n")) {
      this.processLine(line);
    }
    this.handleErrors();
  }


  processLine(line) {
    if (line.match(/^ERROR:\s\s/)) {
      this.error_counter += 1;
      this.errors.push(line);
    }
    if (line.match(/^NOTICE:\s\s/)) {
      this.messages_counter += 1;
      this.messages.push(line);
    }
    if (line.match(/^WARNING:\s\s/)) {
      this.warning_counter += 1;
      this.warnings.push(line);
    }

  }

  handleErrors() {
    if (this.error_counter > 0 || this.messages_counter > 0 || this.warning_counter > 0) {
      this.error_handler(this.error_counter, this.errors, this.warnings, this.messages);
    }
  }

  getErrors() {
    return this.errors;
  }

  getMessages() {
    return this.messages;
  }

  getWarnings() {
    return this.warnings;
  }

}


// export class PsqlQueryParser {
//
//   c = 0;
//   txt = '';
//   query = '';
//   queries = [];
//   terminator = null;
//   emptyLineFlag = false;
//
//   constructor() {
//   }
//
//   reset() {
//     this.c = 0;
//     this.txt = '';
//     this.query = '';
//     this.queries = [];
//     this.terminator = null;
//     this.emptyLineFlag = false;
//   }
//
//   _addline(line) {
//     this.query += (line + "\n");
//     this.txt += (line + "\n");
//   }
//
//   _addQuery() {
//     let q = this.query.trim();
//     if (q != '') {
//       this.queries.push(q);
//     }
//     this.query = '';
//   }
//
//
//   addLine(line) {
//     this.c += 1;
//     this.emptyLineFlag = false;
//     line = line.replace(/--.*$/, ' ');
//     let emptyLine = (line.match(/^\s*$/));
//     if (emptyLine) {
//       this.emptyLineFlag = true;
//       if (this.c == 1) {
//         return 1;
//       }
//     }
//     let terminatorMatch = null;
//     if (!this.terminator && (terminatorMatch = line.match(/(\$\w*\$)\s*$/))) {
//       this.terminator = terminatorMatch[1];
//     }
//     this._addline(line);
//     if (!terminatorMatch && this.terminator) {
//       if (line.includes(this.terminator)) {
//         this.terminator = null;
//         this._addQuery();
//         return 2;
//       }
//     } else if (line.match(/\;\s*$/)) {
//       this._addQuery();
//       return 3;
//     } else if (line.match(/^\s*\\/)) {
//       this._addQuery();
//       return 4;
//     } else if (line.match(/\gset\s*$/) || line.match(/\gset\s+\w+\s*$/) || line.match(/\\crosstabview/) || line.match(/\\gexec\s*$/)) {
//       this._addQuery();
//       return 5;
//     }
//     return 0;
//   }
//
//   isEmptyLine() {
//     return this.emptyLineFlag;
//   }
//
//   addText(text) {
//     let final_rep = null;
//     let lines = text.split("\n");
//     for (line of lines) {
//       let rep = this.addLine(line);
//       if (!this.isEmptyLine()) {
//         final_rep = rep;
//       }
//     }
//     if (!final_rep) {
//       if (this.query != '') {
//         this.query += ';'
//         this.queries.push(this.query);
//       }
//       this.txt += ';';
//     }
//   }
//
//   getQueries() {
//     return this.queries;
//   }
//
//   getText() {
//     return this.txt;
//   }
//
//   getLinesCount() {
//     return this.c;
//   }
//
// }


class PsqlCommandController {
  emitter;
  // regexp_connect = new RegExp('\\\\c\\s+\\w+');
  // regexp_begin = new RegExp('(^|;\\s*)begin\\s*(transaction|work|;)', 'i');
  // regexp_commit = new RegExp('(^|;\\s*)commit\\s*(transaction|work|;)', 'i');
  // regexp_rollback = new RegExp('(^|;\\s*)rollback\\s*(to\s*savepoint|transaction|work|;)', 'i');

  regexp_connect1 = new RegExp('\\\\c\\s+\\w+');
  regexp_connect2 = new RegExp('\\\\connect\\s+\\w+');
  regexp_begin = new RegExp('begin\\s*(transaction|work)?', 'i');
  regexp_commit = new RegExp('commit\\s*(transaction|work)?', 'i');
  regexp_rollback = new RegExp('rollback\\s*(to\s*savepoint|transaction|work)?', 'i');
  regexp_gset = new RegExp('\\\\gset');
  regexp_set = new RegExp('\\\\set');

  constructor() {
    //console.log("🛈🛈 NEW PsqlCommandController");
    this.emitter = new Emitter();
  }

  onDidBegin(callback) {
    return this.emitter.on('did-begin', callback);
  }

  onDidCommit(callback) {
    return this.emitter.on('did-commit', callback);
  }

  onDidRollback(callback) {
    return this.emitter.on('did-rollback', callback);
  }

  onDidConnect(callback) {
    return this.emitter.on('did-connect', callback);
  }

  onDidError(callback) {
    return this.emitter.on('did-error', callback);
  }

  onDidGset(callback) {
    return this.emitter.on('did-gset', callback);
  }

  error(message, detail) {
    this.emitter.emit('did-error', {message: message, detail: detail});
  }

  commit() {
    this.emitter.emit('did-commit');
  }

  begin() {
    this.emitter.emit('did-begin');
  }

  rollback() {
    this.emitter.emit('did-rollback');
  }

  gset() {
    this.emitter.emit('did-gset');
  }


  checkCommand(cmd) {
    let rep = [];
    //console.log("#CHECK COMMAND",cmd['clean']);
    let clean_cmds = cmd['clean'];
    if (clean_cmds) {
      for (let cmdc of clean_cmds) {
        //console.log("#CHECK COMMAND:", '>'+cmdc+'<');
        if (cmdc.match(this.regexp_connect1) || cmdc.match(this.regexp_connect2)) {
          this.emitter.emit('did-connect');
          //atom.notifications.addWarning('instead "\\c" USE Connection Dialog in order to connect', {dismissable: true});
          rep.push('did-connect');
        }
        if (cmdc.match(this.regexp_begin)) {
          this.begin();
          rep.push('did-begin');
        }
        if (cmdc.match(this.regexp_commit)) {
          this.commit();
          rep.push('did-commit');
        }
        if (cmdc.match(this.regexp_rollback)) {
          this.rollback();
          rep.push('did-rollback');
        }
        if (cmdc.match(this.regexp_set) || cmdc.match(this.regexp_gset)) {
          //console.log("GSET");
          this.gset();
          rep.push('did-gset');
        }
      }

    }
    return rep;
  }

}

export const psqlCommandControllerInstance = new PsqlCommandController();