'use babel';
import fs from 'fs';
import {$, $$$} from 'atom-space-pen-views';
import streamBuffers from 'stream-buffers';

export const PSQLRC = '/tmp/.atom-psqlrc';
export const PSQL_EDITOR_CMD = '/tmp/.atom-psqledit';

export class PsqlControler {

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
\\set PROMPT1 '‡%/: '
\\set PROMPT2 '_%/- '
\\set PROMPT3 '_>> '
\\set help '\\\\echo pager_more | pager_less | pager_on | pager_off \\\\echo bash \\\\echo atom_capture_start atom_capture_stop'
\\pset pager on
\\set QUIET 0
--

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

    this.PSQL_BIN = atom.config.get('atom-psql.psqlCommand');
  }

  //PRIVATE
  initPSQL() {
    if (!fs.existsSync(PSQL_EDITOR_CMD)) {
      console.log("##EDITOR");
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
        console.log(init_psqlrc + " NOT FOUND")
        fs.closeSync(fs.openSync(PSQLRC, 'w'));
      }
      fs.appendFileSync(PSQLRC, this.PSQLRC_DATA);
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

  //
  //  * throws exectpion:
  //  * error.status;
  //  * error.message;
  //  * error.stderr;   Holds the stderr output. Use .toString()
  //  * error.stdout;   Holds the stdout output. Use .toString()
  // /
  //  private
  getPSQLCMD() {
    //let ENV = this.getENV();
    let psql_cmd = this.PSQL_BIN + ' ' + this.PSQL_ARGS + ' ' + this.PSQL_REDIRECT_ARGS;
    return psql_cmd;
  }


  testConnection() {
    //psql -c "select current_database()" cat1
    this.initPSQL();
    this.PSQL_ARGS = '-t -A';
    let ENV = this.getENV();
    let psql_cmd = this.getPSQLCMD();
    let options = this.getExecOptions();
    //console.log('cmd', psql_cmd);
    const cp = require('child_process');
    const SQL = 'select current_database();'
    options.input= SQL;
    try {
      let rep = cp.execSync(psql_cmd, options);
      let check =rep.toString().trim();
      if (check ==  this.PGDATABASE){
        return check;
      }
      return false;
    }catch(err){
      return false;
    }
   // console.log(rep.toString());
  }

  //
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


  exec(SQL, callback) {
    this.initPSQL();
    //let ENV = this.getENV();
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

  processTuples(SQL, callback, errorsHandler) {
    let errorParser = new PsqlErrorParser(errorsHandler);
    this.PSQL_ARGS = " -t -A -0 -F\"\x01\" ";
    return this.exec(SQL, (error, stdout, stderr) => {
      if (error != null) {
        let err_msg = "PSQL ERROR: " + JSON.stringify(error);
        errorsHandler(1, [err_msg], []);
        return;
      }
      if (stderr) {
        errorParser.processTextPsqlOutput(stderr);
        return;
      }
      let lines = stdout.split("\x00");
      for (let line of lines) {
        let fields = line.split("\x01");
        callback(fields);
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
  message_buffer = '';
  error_handler;

  constructor(error_handler) {
    if (error_handler) {
      this.error_handler = error_handler;
    } else {
      this.error_handler = (error_counter, errors, messages) => {
        console.log("PSQL ERROR  COUNTER: ", error_counter);
        console.log("PSQL ERRORS: ", errors);
        console.log("PSQL MESSAGES: ", messages);
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
    //if (line.match(/^ERROR:\s+\w+:\s/)) {
    let reg = new RegExp(/^ERROR:\s\s/);
    let found;
    if (found = line.match(reg)) {
      this.error_counter += 1;
      this.errors.push(line);
    }
    this.message_buffer += (line + "<br/>");
  }

  handleErrors(handler) {
    if (this.message_buffer != '') {
      this.messages.push(this.message_buffer);
    }
    if (this.error_counter > 0) {
      this.error_handler(this.error_counter, this.errors, this.messages);
    }
  }

}


