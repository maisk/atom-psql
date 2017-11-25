'use babel';

export class PsqlQueryParser {

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
    this.terminatorRegexpStr = null;
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
  }

  _addline(line) {
    this.query += (line + "\n");
    this.txt += (line + "\n");
  }

  _addQuery() {
    let q = this.query.trim();
    //line.split("\x01");

    if (q != '') {
      this.queries.push(q);
      let qclean = this.cleanQuery.trim();
      let cleanq =[];
      let qcs = qclean.split(';');
      for (let c of qcs){
        let cc = c.trim().replace(/\s+/g,' ');
        if (cc!=''){
          cleanq.push(cc);
        }
      }
      this.queriesExtend.push({q:q,clean:cleanq});
    }
    this.resetQuery();
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
    const string_placeholder = " ''";
    //REMOVE REGULAR QUOTED STRINGS
    this.cleanQuery = this.cleanQuery.replace(/E'(?:[^'\\]|\\.)*'/g, string_placeholder);
    this.cleanQuery = this.cleanQuery.replace(/'.*?'/g, string_placeholder);
    let tmp = this.cleanQuery;
    let broken = false;

    if (this.terminator) {
      if (line.includes(this.terminator)) {
        let regexp1 = new RegExp(this.terminatorRegexpStr + '.*?' + this.terminatorRegexpStr, 'g');
        this.cleanQuery = this.cleanQuery.replace(regexp1, string_placeholder);
      } else {
        if (this.cleanQuery.includes(this.terminator)) {
          //console.log("@: broken1");
          broken = true;
        }
      }
    }
    // console.log("@clean:",this.cleanQuery);
    // console.log("@tmp  :",this.tmp);
    let terminatorMatch = null;
    if (!this.terminator && (terminatorMatch = line.match(/(\$\w*\$)/))) {
      this.terminator = terminatorMatch[1];
      this.terminatorRegexpStr = this.escapeRegExp(this.terminator);
      let regexp1 = new RegExp(this.terminatorRegexpStr + '.*?$', 'g');
      tmp = tmp.replace(regexp1, '');
      //console.log("@: broken2");
      broken = true;
    }
    if (!this.openQuote && tmp.includes(`'`)) {
      this.openQuote = true;
      tmp = tmp.replace(/'.*?$/, '');
      //console.log("@: broken3");
      broken = true;
    }

    this._addline(line);
    if (broken) {
      //console.log("@: broken return");
      return;
    }

    if (tmp.match(/\;\s*$/)) {
      this._addQuery();
      return 3;
    } else if (tmp.match(/^\s*\\/)) {
      this._addQuery();
      return 4;
    } else if (tmp.match(/\gset\s*$/) || tmp.match(/\gset\s+\w+\s*$/) || tmp.match(/\\crosstabview/) || tmp.match(/\\gexec\s*$/)) {
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
        this.query += ';'
        this.queries.push(this.query);
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
