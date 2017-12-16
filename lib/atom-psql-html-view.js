'use babel';

import {CompositeDisposable, Disposable} from 'atom';
import {$, $$$, ScrollView} from 'atom-space-pen-views';
import fs from 'fs';
//import electron from 'electron';
import Utils from './utils.js';

export default class PsqlHtmlView extends ScrollView {

  static content() {
    //'<div class="atom-psql-html native-key-bindings" tabindex="-1">';
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

    let doc =(fileType == 'text') ? '<div class="psql-out-text">':'<div class="psql-out-html">';
    //let doc = '';
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
      doc +='</div>';
      self.append(doc);
      self.setup();
    });


    atom.contextMenu.add({
      'div.atom-psql-html': [{
        label: 'open in editor',
        command: 'atom-psql:edit_query_results'
      }, {
        label: 'Copy',
        command: 'core:copy',
      },
      ]
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
  }



  setup(){
    // console.log("setup");
    // let self = this;
    // let root_el = $(this.element);
    //
    // const remote = electron.remote;
    // const {Menu, MenuItem} = remote
    // const inputMenuTamplate = [
    //   {
    //     label: 'Cut',
    //     role: 'cut',
    //   }, {
    //     label: 'Copy',
    //     role: 'copy',
    //   }, {
    //     label: 'Paste',
    //     role: 'paste',
    //   }
    // ];
    // const contextMenu = Menu.buildFromTemplate(inputMenuTamplate);
    //
    // $('div.atom-psql-html table').each((idx,table)=>{
    //     table.addEventListener('contextmenu', (e) => {
    //     e.preventDefault();
    //     e.stopPropagation();
    //     contextMenu.popup(remote.getCurrentWindow());
    //   });
    // });
  }





  serialize() {
    let data = {
      'ordinal': this.ordinal,
      'title': this.title,
      'filePath': this.filePath,
      'fileType': this.fileType
    };
    return {'deserializer': 'PsqlHtmlView', 'data': data};
  }



  // Tear down any state and detach
  destroy() {
    this.element.remove();
    // try {
    //   if (fs.existsSync(this.filePath)) {
    //     fs.unlinkSync(this.filePath);
    //   }
    // } catch (err) {
    //   console.log(err);
    // }
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




	getIconName() {
		return 'database';
	}


	// getDefaultLocation() {
	// 	return 'bottom';
	// }
	//
	// getAllowedLocations(){
	// 	return ['right', 'left', 'bottom',  'center'];
	// }


}
