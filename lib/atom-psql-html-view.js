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
      if (data) {
        doc += data.toString('utf8');
      }
    });
    rr.on('error', (err) => {
      atom.notifications.addError(JSON.stringify(err));
    });
    rr.on('end', () => {
      self.append(doc);
      self.setup();
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


    // let getTextNodesIn = function (el) {
    //   return $(el).find(":not(iframe)").addBack().contents().filter(function () {
    //     return this.nodeType == 3;
    //   });
    // };
    // console.log(this.element);
    // let root_el = $(this.element);
    // let text_nodes = getTextNodesIn(root_el);
    // console.log("txT:");
    // text_nodes.each((idx,el)=>{
    //     console.log(el);
    // });



  }






  setup(){
    console.log("setup");
    let self = this;
    let root_el = $(this.element);

    const electron = require('electron');
    const remote = electron.remote;
    //const Menu = remote.Menu;
    const {Menu, MenuItem} = remote
    const inputMenuTamplate = [
      {
        label: 'Cut',
        role: 'cut',
      }, {
        label: 'Copy',
        role: 'copy',
      }, {
        label: 'Paste',
        role: 'paste',
      }, {
        label: 'Select all',
        role: 'selectall',
      }, {
        type: 'separator',
      },
    ];


    let addDbTableForm = function(root_el){
      let form = $('<div id="tableform">');
      let tableInput = $(`<input id="dbtableinput" type="text">`);
      let idInput = $(`<input id="dbidinput" type="text">`);
      let button =$('<button id="saveTableBtn">save</button>');

      button.click(()=>{
        let table = tableInput.val().trim();
        let id = idInput.val().trim();
        let okFlag =true;
        if (table==''){
          atom.notifications.addError('table name missing');
          okFlag = false;
        }
        if (id==''){
          atom.notifications.addError('id column name missing');
          okFlag = false;
        }
        if (okFlag) {

          atom.notifications.addInfo("SAVE IN TABLE " + table + ' WITH ID: ' + idInput);
        }
      });

      form.append('<span>table:</span>');
      form.append(tableInput);
      form.append('<span>id:</span>');
      form.append(idInput);
      //form.append(button);
      root_el.append(form);
    }




    root_el.find("tr").each((idx,el)=>{
      let tr = $(el);
      tr.attr('ord',idx);
      if (idx == 0){
        return;
      }
      tr.click((e)=>{
          let cell = $(e.target).get(0); // This is the TD you clicked
          let cellEl = $(cell);
          let tag = cellEl.prop('tagName');
          if (tag != 'TD'){
            return;
          }
          let tr = cellEl.parent();
          let table = tr.parent();
          console.log(table[0]);
          if (!table.attr("update_form")){
            table.attr("update_form",1);
            let len = table.children().length;
            let tr1 =$("<tr>");
            let td1 =$("<td>");
            td1.attr('colspan',len);
            tr1.append(td1);
            table.prepend(tr1);
            addDbTableForm(td1);
          }
          let ord =tr.attr('ord');
          //console.log(ord);
          $('td', tr).each(function(i, td){
              if(td===cell){
                //console.log("FOUND",ord,i);
                let tdel = $(td);
                let value =tdel.text();
                tdel.empty();
               let input =$('<textarea class="tdinput"></textarea>');
                input[0].addEventListener('contextmenu', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const InputMenu = Menu.buildFromTemplate(inputMenuTamplate);
                  let clickHandler = function(){
                    console.log('item: ' + ord + ' - ' + i);
                    tdel.empty();
                    tdel.text(value);
                  };
                  InputMenu.append(new MenuItem({label: 'reset',click:clickHandler }));
                  InputMenu.popup(remote.getCurrentWindow());
                });
                input.val(value);
                tdel.append(input);
                input[0].select();
              }
          });
        });
    });



  }

// <atom-text-editor tabindex="-1" mini="" placeholder-text="5432" class="editor mini" data-encoding="utf8" data-grammar="text plain null-grammar">
// <div style="position: relative; contain: strict; overflow: hidden; background-color: inherit; height: 27px; width: 100%;">
// <div class="scroll-view" style="position: absolute; contain: strict; overflow: hidden; top: 0px; bottom: 0px; background-color: inherit; left: 0px; width: 201px;">
// <div style="contain: strict; overflow: hidden; background-color: inherit; width: 201px; height: 27px; will-change: transform; transform: translate(0px, 0px);">
// <div class="highlights" style="contain: strict; position: absolute; overflow: hidden; height: 27px; width: 201px;"></div>
// <div class="lines" style="position: absolute; contain: strict; overflow: hidden; width: 201px; height: 27px;">
// <div style="contain: layout style; position: absolute; height: 27px; width: 201px; transform: translateY(0px);">
// <div class="line" data-screen-row="0"><span><span class="syntax--text syntax--plain syntax--null-grammar"></span></span> </div></div>
// <div class="placeholder-text">5432</div><div class="cursors" style="position: absolute; contain: strict; z-index: 1; width: 201px; height: 27px; pointer-events: none;">
// <input class="hidden-input" tabindex="-1" style="position: absolute; width: 1px; height: 27px; top: 0px; left: 0px; opacity: 0; padding: 0px; border: 0px;">
// <div class="cursor" style="height: 27px; width: 7.6875px; transform: translate(0px, 0px);"></div></div></div>
// <div style="contain: strict; position: absolute; visibility: hidden; width: 201px;"></div>
// <div class="line dummy" style="position: absolute; visibility: hidden;">
// <span>x</span><span>我</span><span>ﾊ</span><span>세</span></div></div></div></div>
// </atom-text-editor>



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
    try {
      // if (fs.existsSync(this.filePath)) {
      //   fs.unlinkSync(this.filePath);
      // }
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
