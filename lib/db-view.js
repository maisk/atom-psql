/** @babel */
/** @jsx etch.dom */

import {Emitter, CompositeDisposable} from 'atom';
//import etch from 'etch';
import {$, $$$} from 'atom-space-pen-views';
import {
  PSQL_EDITOR_CMD,
  psqlCommandControllerInstance,
  PsqlController,
  PsqlErrorParser,
  PSQLRC
} from "./psql.js";
import {SELECT_VIEW_URI} from './rel-view';

export const DB_VIEW_URI = 'atom://atom-psql/db-view';

export class AtomPsqlDBView {

  constructor(provider) {
    //console.log("NEW DB-VIEW:", relation);
    this.disposables = new CompositeDisposable();
    this.element=  document.createElement('psql-db');
    //this.element.setAttribute('class','native-key-bindings');
    this.element.setAttribute('tabindex','-1');
    this.liveFlag = true;
    this.provider = provider;
    if (provider) {
      this.current_database = provider.metadata_db;
    }
    this.title =  (this.current_database) ?  this.current_database :'relations';

    this.refreshData();

    let self = this;


    let root = $(this.element);
    //console.log(this.element);

    this.disposables.add(atom.commands.add(this.element, {
       'core:move-right': () => {
         root.scrollLeft(root.scrollLeft() + $(window).width() / 10);
       },
       'core:move-left': () => {
         root.scrollLeft(root.scrollLeft() - $(window).width() / 10);
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
  }

  serialize() {
    // return {
    //   //deserializer: 'TerminalView'
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
    return DB_VIEW_URI;
  }

  refreshData() {
      this._refresh_metadata();
  }


  _refresh_metadata() {

    if (this.provider.metadata_db) {
      this.current_database = this.provider.metadata_db;
    }
    if (!this.provider.atomPsqlTables) {
      return;
    }

    let rels = {};
    let rels1 = this.provider.atomPsqlTables;
    for (let rel of rels1) {
      let schema = rel.schemaName;
      let type = rel.type;
      let name = rel.name;
      if (!rels[schema]) {
        rels[schema] = {
          'Table': {},
          'View': {},
        };
      }
      rels[schema][type][name] = rel;
    }
    //console.log(rels);

    let rootEl = $(this.element);
    rootEl.empty();

    let relSpan = function (container, schema, relations) {
      let te = $('<div class="t1">');
      for (let name in relations) {
        let span = $('<span class="rel">' + name + '</span>');
        span.data('relation', relations[name]);
        span.click(function (e) {
          let relation = $(this).data('relation');
          let uri = SELECT_VIEW_URI + '/' + relation.schemaName + '.' + relation.name;
          atom.workspace.open(uri);
        });
        te.append(span);
        te.append(" ");
      }
      te.appendTo(container);
    }

    let printSchema = function (container, rels, schema) {
      let tables = rels[schema]['Table'];
      let views = rels[schema]['View'];
      let se = $('<div class="s1">');
      let se12 = $('<div class="s12">');
      $('<div class="s13">' + ' &#160; ' + schema + ' &#160; ' + '</div>').appendTo(se12);
      container.append(se12);
      relSpan(se12, schema, tables);

      if (!$.isEmptyObject(views)) {
        let se22 = $('<div class="s22">');
        $('<div class="s23">' + ' &#160; ' + schema + ' &#160; ' + '</div>').appendTo(se22);
        container.append(se22);
        relSpan(se22, schema, views);
      }
    }

    if (rels['public']) {
      printSchema(rootEl, rels, 'public');
    }
    for (let schema in rels) {
      if (schema != 'public') {
        printSchema(rootEl, rels, schema);
      }
    }
  }
}


