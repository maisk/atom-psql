'use babel';

//import {CompositeDisposable, Disposable} from 'atom';
import {$, $$$, ScrollView} from 'atom-space-pen-views';
import fs from 'fs';


export default class PsqlHtmlView extends ScrollView {

  static content() {
    return this.div({class: 'atom-psql-html native-key-bindings', tabindex: -1});
    // return this.div({class: 'atom-psql-html native-key-bindings', tabindex: -1}, () => { return this.div({class: 'psql_out'}) });
  }

  constructor({ordinal, title, filePath}) {
    super();
    this.ordinal = ordinal;
    this.title = title;
    this.filePath = filePath;

    let self = this;
    fs.readFile(filePath, 'utf8', function (err, data) {
      if (err) {
        console.log(err);
        throw err;
      }

      self.append(data);

      if (false) {
        let contents = $(self.element).contents();
        contents.each((idx, el) => {
          if (el.nodeType == 3) {
            for (let line of el.nodeValue.split("\n")) {
              //console.log(line);
              if (line.match(/^ERROR:\s+\w+:\s/)) {
                atom.notifications.addWarning(line);
              }
            }
          }
        });
      }

    });

  }

  serialize() {
    // let data = {'filePath':this.filePath};
    // return {'deserializer': 'PsqlHtmlView', 'data': data } ;
  }


  // Tear down any state and detach
  destroy() {
    this.element.remove();
    try {
      fs.unlinkSync(this.filePath);
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


}
