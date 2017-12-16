/** @babel */
/** @jsx etch.dom */

import {Emitter, CompositeDisposable} from 'atom';
import {$, $$$} from 'atom-space-pen-views';
import {
  PSQL_EDITOR_CMD,
  psqlCommandControllerInstance,
  PsqlController,
  PsqlErrorParser,
  PSQLRC
} from "./psql.js";

export const RELATION_VIEW_URI = 'atom://atom-psql/relation-view';

export class AtomPsqlRelationView {

  constructor(provider, relation) {
    if (!relation){
      throw "error";
    }
    this.disposables = new CompositeDisposable();
    this.element=  document.createElement('psql-rel');
    //this.element.setAttribute('class','native-key-bindings');
    this.element.setAttribute('tabindex','-1');
    this.liveFlag = true;
    this.provider = provider;
    this.relation = relation;
    if (provider) {
      this.current_database = provider.metadata_db;
    }
    this.title =relation;

    this.refreshData();

    let self = this;
    atom.contextMenu.add({
      'psql-rel': [{
        label: 'Copy',
        command: 'core:copy',
      },
        {
          label: 'SELECT * LIMIT 20;',
          command: 'atom-psql:select_head',
          'shouldDisplay': function (event) {
            console.log(event,self);
            console.log(self.relation);
            if (self.relation){
              return true;
            } else {
              return false;
            }
          }
        },
        {
          label: '\\d+',
          command: 'atom-psql:describe',
          'shouldDisplay': function (event) {
            if (self.relation){
              return true;
            } else {
              return false;
            }
          }
        },
      ]
    });

    let root = $(this.element);
    this.disposables.add(atom.commands.add(this.element, {
      'core:move-right': () => {
        root.scrollLeft(root.scrollLeft() + $(window).width() / 20);
      },
      'core:move-left': () => {
        root.scrollLeft(root.scrollLeft() - $(window).width() / 20);
      },
      'core:move-up': () => {
        root.scrollTop(root.scrollTop() - $(window).height() / 20);
      },
      'core:move-down': () => {
        root.scrollTop(root.scrollTop() + $(window).height() / 20);
      },
      'core:page-up': () => {
        root.scrollTop(root.scrollTop() - root.height());
      },
      'core:page-down': () => {
        root.scrollTop(root.scrollTop() + root.height());
      },
      'core:move-to-top': () => {
        root.scrollTop()
      },
      'core:move-to-bottom': () => {
        root.scrollTop(root.prop('scrollHeight'));
      },
      }));

    this.disposables.add(atom.commands.add(this.element, {
      'atom-psql:select_head':() => this._refresh_relation('top'),
      'atom-psql:describe':() => this._refresh_relation(),
    }));


  }


  serialize() {
    // return {
    //   //deserializer: ''
    // };
  }

  destroy() {
    this.liveFlag = false;
    this.disposables.dispose();

  }

  close() {
    //console.log('CLOSE DB VIEW', this.title);
    let pane = atom.workspace.paneForItem(this);
    if (pane) {
      pane.destroyItem(this);
    } else {
      this.destroy();
    }
  }


  clear() {
  }


  getDefaultLocation() {
    return 'bottom';
  }


  getIconName() {
    return 'table';
  }


  getTitle() {
    return this.title;
  }

  getURI() {
      return (RELATION_VIEW_URI + '/' + this.relation);
  }

  refreshData() {
     this._refresh_relation();
  }

  _refresh_relation(type) {
    console.log("_refresh_relation:", type , this.relation);

    let self = this;
    let psql = new PsqlController({'PGPASS': this.provider.PGPASS});
    let rootEl = $(this.element);

    let cmd = null;

    if (type && type == 'top'){
      cmd = 'SELECT * FROM  ' + this.relation + ' limit 20';

    } else {
      cmd = '\\d+ ' + this.relation;
      // psql.exec(cmd, function (txt) {
      //   rootEl.empty();
      //   let div = $('<div class="describe">');
      //   div.appendTo(rootEl);
      //   let pre = $('<p class="pre">');
      //   pre.text(txt);
      //   pre.appendTo(div);
      // }, {
      //   error_dismisable: false,
      //   after_error_handling: function (error, txt) {
      //     self.close();
      //   },
      // });

    }

    psql.exec(cmd, function (txt) {
      rootEl.empty();
      let div = $('<div class="describe">');
      div.appendTo(rootEl);
      let pre = $('<p class="pre">');
      pre.append('<span class="cmd">' + cmd + '</span>');
      pre.append(txt);
      pre.appendTo(div);
    }, {
      error_dismisable: false,
      after_error_handling: function (error, txt) {
        self.close();
      },
      'psql_args' : ' --pset=format=html --pset=border=0 -T \'class="psqltable"\''
    });




  }

}


