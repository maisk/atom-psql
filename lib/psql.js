'use babel';
import fs from 'fs';
import {$, $$$} from 'atom-space-pen-views';

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

  getPSQL_CONN_URL(){
    let conn_url = 'postgresql://' + this.PGHOST + ':' + this.PGPORT +'/' + this.PGDATABASE +'?user=' + encodeURIComponent(this.PGUSER);
    if (this.PGPASS) {
      conn_url+=('&password=' + encodeURIComponent(this.PGPASS));
    }
    return conn_url;
  }

  getPSQL_ARGS(){
    if (this.PGPASS){
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


  parseConnInfo(conninfoStr){
        let match;
        match = conninfoStr.match(/^[\s|\w]+"(\w+)"[\.|\s|\w]+"([\.\w]+)"[\s|\w]+"([\.\w]+)"[\s|\w]+"([\.\w]+)"/);
        if (match.length >= 5) {
          return {
           PGDATABASE :  match[1],
           PGUSER: match[2],
           PGHOST: match[3],
           PGPORT: match[4],
          }
        }
        return null;
  }

  testConnection(verifyFlag) {
    if (verifyFlag === undefined){
      verifyFlag = true;
    }
    this.initPSQL();
    this.PSQL_ARGS = '-t -A';
    let ENV = this.getENV();
    let psql_cmd = this.getPSQLCMD();
    let options = this.getExecOptions();
    const cp = require('child_process');
    const SQL = '\\conninfo';
    options.input= SQL;
    try {
      let txt = cp.execSync(psql_cmd, options);
      if (verifyFlag){
        console.log('testConnection: verify');
        let conninfo = this.parseConnInfo(txt);
        if (conninfo['PGUSER'] != this.PGUSER){
          return {result:false, msg:'PGUSER' };
        }
        if (conninfo['PGHOST'] != this.PGHOST){
          return {result:false, msg:'PGHOST' };
        }
        if (conninfo['PGPORT'] != this.PGPORT){
          return {result:false, msg:'PGPORT' };
        }
        if (conninfo['PGDATABASE'] != this.PGDATABASE){
          return {result:false, msg:'PGDATABASE' };
        }
      }
      return {result:true};
    }catch(err){
      return {result:false, msg:err}
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

  //callback(error, stdout, stderr)
  exec(SQL, callback) {
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


  execPromise(SQL) {
    let self = this;
    return new Promise((resolve, reject) => {
      self.exec(SQL, (error, stdout, stderr) => {
        if (error != null) {
          reject(error, stdout, stderr);
          return;
        }
        resolve(stdout, stderr);
      });
    });
  }

  processTuples(SQL, callbackRecord, callbackFinish, errorsHandler) {
    let errorParser = new PsqlErrorParser(errorsHandler);
    this.PSQL_ARGS = " -t -A -0 -F\"\x01\" ";
    return this.exec(SQL, (error, stdout, stderr) => {
      if (error != null) {
        errorsHandler(1, [stderr], []);
        return;
      }
      if (stderr) {
        errorParser.processTextPsqlOutput(stderr);
        return;
      }
      let lines = stdout.split("\x00");
      for (let line of lines) {
        let fields = line.split("\x01");
        callbackRecord(fields);
      }
      if (callbackFinish){
        callbackFinish();
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

  messages = [];
  errors = [];
  error_counter = 0;
  messages_counter = 0;
  message_buffer = '';
  error_handler;

  constructor(error_handler) {
    if (error_handler) {
      this.error_handler = error_handler;
    } else {
      this.error_handler = (error_counter, errors, messages,text) => {
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
    if ( line.match(/^ERROR:\s\s/)) {
      this.error_counter += 1;
      this.errors.push(line);
    }
    if ( line.match(/^NOTICE:\s\s/)) {
      this.messages_counter += 1;
      this.messages.push(line);
    }
    this.message_buffer += (line + "<br/>");
  }

  handleErrors(handler) {
    if (this.error_counter > 0 || this.messages_counter > 0) {
      this.error_handler(this.error_counter, this.errors, this.messages,this.message_buffer);
    }
  }

  getErrors(){
    return this.errors;
  }

  getMessages(){
    return this.messages;
  }

}






export class PsqlQueryParser {

  c = 0;
  txt = '';
  query = '';
  queries = [];
  terminator = null;
  emptyLineFlag = false;

  constructor() {  }

  reset() {
    this.c = 0;
    this.txt = '';
    this.query = '';
    this.queries = [];
    this.terminator = null;
    this.emptyLineFlag = false;
  }

  _addline(line) {
    this.query += (line + "\n");
    this.txt += (line + "\n");
  }

  _addQuery() {
    let q = this.query.trim();
    if (q != '') {
      this.queries.push(q);
    }
    this.query = '';
  }


  addLine(line) {
    this.c += 1;
    this.emptyLineFlag = false;
    line = line.replace(/--.*$/, ' ');
    let emptyLine = (line.match(/^\s*$/));
    if (emptyLine) {
      this.emptyLineFlag = true;
      if (this.c == 1) {
        return 1;
      }
    }
    let terminatorMatch = null;
    if (!this.terminator && (terminatorMatch = line.match(/(\$\w*\$)\s*$/))) {
      this.terminator = terminatorMatch[1];
    }
    this._addline(line);
    if (!terminatorMatch && this.terminator) {
      if (line.includes(this.terminator)) {
        this.terminator = null;
        this._addQuery();
        return 2;
      }
    } else if (line.match(/\;\s*$/)) {
      this._addQuery();
      return 3;
    } else if (line.match(/^\s*\\/)) {
      this._addQuery();
      return 4;
    } else if (line.match(/\gset\s*$/) || line.match(/\gset\s+\w+\s*$/) || line.match(/\\crosstabview/) || line.match(/\\gexec\s*$/)) {
      this._addQuery();
      return 5;
    }
    return 0;
  }

  isEmptyLine(){
    return this.emptyLineFlag;
  }

  addText(text) {
    let final_rep = null;
    let lines = text.split("\n");
    for (line of lines) {
      let rep = this.addLine(line);
      if (!this.isEmptyLine()) {
        final_rep = rep;
      }
    }
    if (!final_rep) {
      if (this.query != ''){
        this.query += ';'
        this.queries.push(this.query);
      }
      this.txt += ';';
    }
  }

  getQueries() {
    return this.queries;
  }

  getText() {
    return this.txt;
  }

  getLinesCount() {
    return this.c;
  }

}
