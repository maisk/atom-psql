'use babel';

import fs from 'fs';
//import {CompositeDisposable, Point, Range} from 'atom';
import {psqlCommandControllerInstance} from "./psql";
import {PsqlQueryParserLine} from "./psql-query-parser-line";


export const ATOMPSQL_ERRORS_FILE = '/tmp/atom-psql-errors.log';

export  class AtomPsqlWatch {

  constructor() {
  }

  init() {
    this.init_fifo();
    //this.init_watch();

    // if (atom.config.get('atom-psql.psql.readFromNamedPipe')) {
    //   this.init_fifo();
    // } else {
    //   this.init_watch();
    // }
  }


  init_fifo() {
    let self = this;
    //console.log("NAMED PIPE");
    const cp = require('child_process');

    //let fifo1 = '/tmp/atom-psql-fifo';
    // if (fs.existsSync(fifo1)) {
    //   fs.unlinkSync(fifo1);
    // }
    // let result = cp.execSync('mkfifo ' + fifo1);
    // if (result && result[0]) {
    //   atom.notifications.addError(JSON.stringify(result));
    // }


    // const fd1 = fs.openSync(fifo1, 'r+')
    // const readable1 = fs.createReadStream(null, {'fd': fd1});
    // readable1.setEncoding('utf8');
    // readable1.on('data', (d) => {
    //   let editor;
    //   if (editor = atom.workspace.getActiveTextEditor()) {
    //     self.insert_text_to_editor(editor, d);
    //   }
    // });




// # ERROR:  syntax error at or near "["
// # LINE 4: ('{m,n,o,p,q,r}'::text[])[1 + floor(random() * 6)] as type_3...
// #                                  ^
// #
// # STATEMENT:  SELECT
// # ('{a,b,c,d,e,f}'::text[])[1 + floor(random() * 6)] as type_1,
// # ('{m,n,o,p,q,r}'::text[])[1 + floor(random() * 6)] as type_2,zz
// #

    let fifo2 = '/tmp/atom-psql-fifo-errors';
    if (fs.existsSync(fifo2)) {
      fs.unlinkSync(fifo2);
    }
    result = cp.execSync('mkfifo ' + fifo2);
    if (result && result[0]) {
      atom.notifications.addError(JSON.stringify(result));
    }

    let error_flag = false;
    let mesg_line = null;
    let line_line = null;
    let statement = null;
    let c = 0;
    let qparser = new PsqlQueryParserLine();


    let clearNotificationData = function () {
      mesg_line = null;
      line_line = null;
      statement = null;
      c = 0;
      qparser.reset();
    }
    let notifyError = function () {
      if (!mesg_line) {
        clearNotificationData();
        return
      }
      ;
      let detail = '';
      if (line_line) {
        detail += (line_line + "\n");
      }
      if (statement) {
        detail += statement;
      }
      psqlCommandControllerInstance.error(mesg_line, detail);
      //atom.notifications.addError(mesg_line, {dismissable: true, detail: detail});
      clearNotificationData();
    };
    let notifyNotice = function (mesg) {
      atom.notifications.addInfo(mesg, {});
    }
    let notifyWarning = function (mesg) {
      atom.notifications.addWarning(mesg, {});
    }
    const fd2 = fs.openSync(fifo2, 'r+');
    const readable2 = fs.createReadStream(null, {'fd': fd2});
    readable2.setEncoding('utf8');
    readable2.on('data', (d) => {
      if (d.length == 1 && d.charCodeAt(0) < 32){
        return;
      }
      fs.appendFile(ATOMPSQL_ERRORS_FILE,d,'utf8', function (err) {
        if (err) {
          console.log(d);
          console.log(err);
          atom.notifications.addError('canot write to: ' + ATOMPSQL_ERRORS_FILE);
        }
      });
        let lines = d.split("\n");
        for (let line of lines) {
          if (line.match(/^NOTICE:\s/)) {
            notifyError();
            notifyNotice(line);
            continue;
          }
          if (line.match(/^WARNING:\s/)) {
            notifyError();
            notifyWarning(line);
            continue;
          }
          if (line.match(/^ERROR:\s/)) {
            notifyError();
            mesg_line = line;
            continue;
          }
          c += 1;
          //console.log("#", c, line);
          if (line.match(/^LINE /)) {
            line_line = line;
            continue;
          }
          //if (line.match(/^STATEMENT: /)){}
          let rep = qparser.addLine(line);
          if (rep > 1) {
            statement = qparser.getText();
            notifyError();
          }
        }
      }
    );

  }


  // insert_text_to_editor(editor, text) {
  //   editor.moveToEndOfLine();
  //   editor.insertText(text);
  // }


  init_watch() {
    // let self = this;
    //
    // let watch_file = '/tmp/atom-psql-fifo';
    // if (fs.existsSync(watch_file)) {
    //   fs.unlinkSync(watch_file);
    // }
    // fs.closeSync(fs.openSync(watch_file, 'w'));
    //
    //
    // // const cp = require('child_process');
    // // let fifo1 = '/tmp/atom-psql-fifo';
    // //  if (fs.existsSync(fifo1)) {
    // //    fs.unlinkSync(fifo1);
    // //  }
    // //  let result = cp.execSync('mkfifo ' + fifo1);
    // //  if (result && result[0]) {
    // //    atom.notifications.addError(JSON.stringify(result));
    // //  }
    // // let watch_file = fifo1;
    //
    //
    //
    // fs.unwatchFile(watch_file);
    // fs.watch(watch_file, (curr, prev) => {
    //   let editor;
    //   if (editor = atom.workspace.getActiveTextEditor()) {
    //     fs.readFile(watch_file, 'utf8', (err, data) => {
    //       if (err) {
    //         atom.notifications.addError(JSON.stringify(err));
    //       } else {
    //         self.insert_text_to_editor(editor, data);
    //       }
    //     });
    //   }
    // });
    //
    //
  }


}



