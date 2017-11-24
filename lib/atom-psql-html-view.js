'use babel';

//import {CompositeDisposable, Disposable} from 'atom';
import {$, $$$, ScrollView} from 'atom-space-pen-views';
import fs from 'fs';


export default class PsqlHtmlView extends ScrollView {

  static content() {
    return this.div({class: 'atom-psql-html native-key-bindings', tabindex: -1});
    // return this.div({class: 'atom-psql-html native-key-bindings', tabindex: -1}, () => { return this.div({class: 'psql_out'}) });
  }

  constructor({ordinal, title, filePath, fileType}) {
    super();
    this.fileType = fileType;
    this.ordinal = ordinal;
    this.title = title;
    this.filePath = filePath;

    let self = this;

    // self.append(filePath);
    // self.append("\n");

    //#####################################################
    let doc = '';
    const rr = fs.createReadStream(filePath);
    rr.on('readable', () => {
      let data = rr.read();
      if (data){
        doc += data.toString('utf8');
      }
    });
    rr.on('error', () => {
      self.append(JSON.stringify(error));
    });
    rr.on('end', () => {
      self.append(doc);
    });
    //#####################################################
    // fs.readFile(filePath, 'utf8', function (err, data) {
    //    console.log("READ DONE",err);
    //    if (err) {
    //      self.append(err);
    //      return;
    //    }
    //    self.append(data);
    //  });
    //#####################################################
    //  let lineByLine = require('n-readlines');
    //  let liner = new lineByLine(filePath);
    //  let line;
    //   let doc ='';
    //   while (line = liner.next()) {
    //     doc += (line.toString('utf8')+"\n");
    //   }
    //   self.append(doc);
    //#####################################################
  }

  serialize() {
    // let data = {'filePath':this.filePath};
    // return {'deserializer': 'PsqlHtmlView', 'data': data } ;
  }


  // Tear down any state and detach
  destroy() {
    this.element.remove();
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
    } catch (err) {
      console.log(err);
    }
  }

  getOrdinal() {
    return this.ordinal;
  }

  getTitle() {
    return this.title;
  }

  getFileType() {
    return this.fileType;
  }

  getFilePath() {
    return this.filePath;
  }

}
