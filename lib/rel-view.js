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

export const RELATION_VIEW_URI = 'atom://atom-psql/relation-describe-view';
export const SELECT_VIEW_URI = 'atom://atom-psql/relation-select-view';

export class AtomPsqlRelationView {

  constructor(provider, relation, type) {
    if (!relation) {
      throw "error";
    }
    if (type && type == 2) {
      this.type = 2;
      this.URI = SELECT_VIEW_URI + '/' + this.relation;
    } else {
      this.type = 1;
      this.URI = RELATION_VIEW_URI + '/' + this.relation;
    }
    this.disposables = new CompositeDisposable();
    this.element = document.createElement('psql-rel');
    //this.element.setAttribute('class','native-key-bindings');
    this.element.setAttribute('tabindex', '-1');
    this.liveFlag = true;
    this.provider = provider;
    this.relation = relation;
    if (provider) {
      this.current_database = provider.metadata_db;
    }
    this.title = relation;

    this.refreshData(this.type);

    let self = this;
    atom.contextMenu.add({
      'psql-rel': [{
        label: 'Copy',
        command: 'core:copy',
      },
        {
          label: 'SELECT * LIMIT 20;',
          command: 'atom-psql:select_head',
          //'shouldDisplay': function (event) {
            // console.log(event, self);
            // console.log(self.relation);
            // if (self.relation) {
            //   return true;
            // } else {
            //   return false;
            // }
         // }
        },
        {
          label: '\\d+',
          command: 'atom-psql:describe',
          // 'shouldDisplay': function (event) {
          //   if (self.relation) {
          //     return true;
          //   } else {
          //     return false;
          //   }
          // }
        },
      ]
    });

    let root = $(this.element);
    this.disposables.add(atom.commands.add(this.element, {
      'core:move-right': () => {
        root.scrollLeft(root.scrollLeft() + $(window).width()/8);
      },
      'core:move-left': () => {
        root.scrollLeft(root.scrollLeft() - $(window).width()/8);
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
      'atom-psql:select_head': () => this.refreshData(2),
      'atom-psql:describe': () => this.refreshData(1),
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
    return this.URI;
  }

  refreshData(type) {
    if (type && type == 2) {
      return this._refresh_sql();
    }
    return this._refresh_describe();
    //this._refresh_relation(type);
  }


  _refresh_describe() {
    let self = this;
    let rootEl = $(this.element);
    let cmd = '\\d+ ' + this.relation;
    let cb = function (txt) {
      rootEl.empty();
      let div = $('<div class="describe">');
      div.appendTo(rootEl);
      let pre = $('<p class="pre">');
      pre.append(txt);
      pre.appendTo(div);
    };

    this._exec_psql(cmd, cb,true);
  }

  _refresh_sql(init_cmd) {
    let self = this;
    let rootEl = $(this.element);

    let cmd_prefix_real = 'SELECT fowxomaqw.* FROM ' + this.relation +' fowxomaqw  ';
    let cmd_suf_real= (init_cmd) ? init_cmd : ' limit 20';
    let cmd_real = cmd_prefix_real +cmd_suf_real;

    let cb = function (txt) {
      rootEl.empty();
      let div = $('<div class="describe">');
      div.appendTo(rootEl);
      let pre = $('<p class="pre">');


      let create_mini_editor = function (id, cssClass) {
        let med = document.createElement("atom-text-editor");
        med.setAttribute("id", id);
        med.setAttribute("mini", "");
        med.setAttribute("class", "editor mini " + cssClass);
        return med;
      }

      let create_mini_editor_wl = function (id, label, cssClass, container) {
        container.append($('<label>').attr('for', id).text(label));
        let med = create_mini_editor(id);
        container.append(med);
        return med;
      }

      let cmd_prefix =  'SELECT * FROM ' + self.relation +' ';
      let user_cmd = cmd_prefix + cmd_suf_real;
      pre.append('<span class="cmd_span">' + user_cmd.trim()+ '</span>');

      // pre.append('<span id="show_inputs"><a href="">[show limit offset]</a></span>');
      let inputs = $('<div class="inputs">');

      let cmd_el = create_mini_editor('cmd', 'cmd', 'cmd');
      let cmd_model = cmd_el.getModel();

       //let cmd2 = init_cmd ? init_cmd : cmd + ' offset 20';
       // cmd_model.setText(cmd2);
      // inputs.append(cmd_el);
      // inputs.appendTo(pre);

      let cmd_suf = init_cmd ?  init_cmd : ' limit 20 offset 20';
       cmd_model.setText(cmd_suf);
       inputs.append('<span class="sel">' + cmd_prefix.trim() + ' </span>');
       inputs.append(cmd_el);
       inputs.appendTo(pre);


      // inputs.append('<span class="sel">SELECT</span>');
      // let what_el = create_mini_editor('what',  'sel');
      // inputs.append(what_el);
      // inputs.append('<span class="sel">FROM ' + self.relation + ' WHERE </span>');
      // let where_el = create_mini_editor('where',  'sel where');
      // inputs.append(where_el);
      // inputs.append('<span class="sel">LIMIT</span>');
      // let limit_el = create_mini_editor('limit', 'sel');
      // inputs.append(limit_el);
      // inputs.append('<span class="sel">OFFSET</span>');
      // let offset_el = create_mini_editor('offset', 'sel');
      // inputs.append(offset_el);



      let button = $('<button class="sel">select</button>');
      button.click(function (ev) {
        let cmd = cmd_model.getText();
        self._refresh_sql(cmd);
      });


      button.appendTo(inputs);
      let div_results = $('<div class="results">');
      pre.append(div_results);
      div_results.append(txt);
      pre.appendTo(div);


    };

    let close_on_exit = (init_cmd) ? false : true;
    this._exec_psql(cmd_real, cb,close_on_exit);
  }

  _exec_psql(cmd, callback, close_on_error) {
    let self = this;
    let opts = {
      error_dismisable: false,
      'psql_args': ' --pset=format=html --pset=border=0 -T \'class="psqltable"\''
    };

    if (close_on_error) {
      opts['after_error_handling'] = function (error, txt) {
        self.close();
      }
    }
    let psql = new PsqlController({'PGPASS': this.provider.PGPASS});
    psql.exec(cmd, callback, opts);

  }


}



