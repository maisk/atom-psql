'use babel';

export class PsqlQueryParserLine {

  constructor() {
    this.reset();
  }

  reset() {
    this.c = 0;
    this.txt = '';
    this.query = '';
    this.queries = [];
    this.queriesExtend = [],
    this.terminator = null;
    this.multilineCommentFlag = false;
    this.terminatorRegexpStr = null;
    this.terminatorRegexpFull = null;
    this.emptyLineFlag = false;
    this.openQuote = false;
    this.cleanQuery = '';
  }

  resetQuery() {
    this.query = '';
    this.cleanQuery = '';
    this.terminator = null;
    this.terminatorRegexpStr = null;
    this.openQuote = false;
    this.multilineCommentFlag = false;
  }

  _addline(line) {
    this.query += (line + "\n");
    this.txt += (line + "\n");
  }

  _addQuery(query =null, reset =true) {

    let q = (query) ? query.trim() : this.query.trim();
    //line.split("\x01");

    if (q != '') {
      this.queries.push(q);
      let qclean = this.cleanQuery.trim();
      let cleanq =[];
      let qcs = qclean.split(';');
      for (let c of qcs){
        //let cc = c.trim().replace(/\x00/g,"❎").replace(/\s+/g,' ');
        let cc = c.trim().replace(/\s+/g,' ');
        if (cc!=''){
          cleanq.push(cc);
        }
      }
      this.queriesExtend.push({q:q,clean:cleanq});
    }
    if (reset) {
      this.resetQuery();
    }
  }


  addLine(line) {
    //console.log('#:  ', line);
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

    this.cleanQuery += (line + " ");

    //const string_placeholder = " \x00";
    const string_placeholder = "❎";
    //REMOVE REGULAR QUOTED STRINGS
    this.cleanQuery = this.cleanQuery.replace(/E'(?:[^'\\]|\\.)*'/g, string_placeholder);
    this.cleanQuery = this.cleanQuery.replace(/'.*?'/g, string_placeholder);

    let broken = false;

    if (this.terminator) {
      if (line.includes(this.terminator)) {
        this.cleanQuery = this.cleanQuery.replace(this.terminatorRegexpFull, string_placeholder);
      } else {
        if (this.cleanQuery.includes(this.terminator)) {
          //console.log("broken 1")
          broken = true;
        }
      }
    }
    if (this.multilineCommentFlag) {
      if (line.includes('*/')) {
        this.cleanQuery = this.cleanQuery.replace(/\/\*.*?\*\//g ,' ');
      } else if (this.cleanQuery.includes('/*')) {
       // console.log("broken 2")
          broken = true;
      }
    }

    let tmp = this.cleanQuery;

    let terminatorMatch = null;
    if (!this.terminator && (terminatorMatch = this.cleanQuery.match(/(\$\w*\$)/))) { //SET TERMINATOR
      this.terminator = terminatorMatch[1];
      this.terminatorRegexpStr = this.escapeRegExp(this.terminator);
      this.terminatorRegexpFull = new RegExp(this.terminatorRegexpStr + '.*?' + this.terminatorRegexpStr, 'g');
      this.cleanQuery = this.cleanQuery.replace(this.terminatorRegexpFull, string_placeholder);
      if (this.cleanQuery.includes(this.terminator)) {
        let regexp1 = new RegExp(this.terminatorRegexpStr + '.*?$', 'g');
        tmp = tmp.replace(regexp1, '');
        //console.log("broken 3")
        broken = true;
      }
    }


    if (!this.multilineCommentFlag && (this.cleanQuery.includes('/*'))) {
      this.multilineCommentFlag = true;
      this.cleanQuery = this.cleanQuery.replace(/\/\*.*?\*\//g ,' ');
      if (this.cleanQuery.includes('/*')) {
        tmp = tmp.replace(/\/\*.*?$/g, ' ');
       // console.log("broken 4")
        broken = true;
      }
    }



    if (!this.openQuote && tmp.includes(`'`)) {
      this.openQuote = true;
      tmp = tmp.replace(/'.*?$/, '');
     // console.log("broken 5")
      broken = true;
    }

    this._addline(line);
    if (broken) {
      return;
    }

    if (tmp.match(/\;\s*$/)) {
      this._addQuery();
      return 3;
    } else if (tmp.match(/^\s*\\/)) {
      this._addQuery();
      return 4;
    } else if (tmp.match(/\gset/) || tmp.match(/\\crosstabview/) || tmp.match(/\\gexec\s*$/)) {
      this._addQuery();
      return 5;
    }
    return 0;
  }

  isEmptyLine() {
    return this.emptyLineFlag;
  }

  addText(text) {
    let final_rep = null;
    let lines = text.split("\n");
    for (let line of lines) {
      let rep = this.addLine(line);
      if (!this.isEmptyLine()) {
        final_rep = rep;
      }
    }
    if (!final_rep) {
      if (this.query != '') {
        this.query = this.query.trim() + ';'
        this._addQuery();
      }
      this.txt += ';';
    }
  }

  getQueries() {
    return this.queries;
  }

  getQueriesExtend() {
    return this.queriesExtend;
  }

  getText() {
    return this.txt;
  }

  getLinesCount() {
    return this.c;
  }

  escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  }

}







//
//
// export class PsqlHistory {
//
//   buffer = '';
//   prevPrompt = 0;
//   prompt = 0;
//   history = [];
//
//   constructor() {
//     this.regexp_prompt1 = new RegExp(atom.config.get('atom-psql.psql.psqlPrompt1Regexp'));
//     this.regexp_prompt2 = new RegExp(atom.config.get('atom-psql.psql.psqlPrompt2Regexp'));
//   }
//
//   getHistory(){
//     return this.history;
//   }
//
//   addLine(line){
//     console.log("h:",line);
//     this.prevPrompt = this.prompt;
//     if (line.match(this.regexp_prompt1)){
//       this.prompt = 1;
//       console.log("prompt1");
//     } else if (line.match(this.regexp_prompt2)){
//       this.prompt = 2;
//       console.log("prompt2");
//     } else {
//       this.prompt = 0;
//       console.log("prompt0");
//     }
//
//     let command = null;
//     if (this.prompt == 1){
//       console.log("RESET");
//       command = this.buffer;
//       this.history.push(command);
//       this.buffer = '';
//     }
//
//     if (! line.match("\n\s*$")){
//       line +="\n";
//     }
//
//     this.buffer += line;
//
//     if (command != null) {
//       console.log("1------------------------")
//       console.log(command);
//       console.log("2------------------------")
//     }
//   }
//
//}
