'use babel';
import fs from 'fs';
import SQLMetaProvider from './providers/sql-meta-provider';
import AtomPsqlController from './atom-psql-controller.js';

export default {

  controller: null,

  psqlHtmlViewDeserialize: function (data) {
    return null;
  },

  activate(state) {
    console.log("activate");
    this.controller = new AtomPsqlController(state);

  },

  provideAutocomplete: function () {
    return new SQLMetaProvider(this.controller);
  },

  consumeTerminalService(service) {
    console.log("consumeTerminalService");
    this.controller.setTerminalService(service);
  },

  deactivate() {
    console.log("deactivate");
    this.controller.destroy();
  },


  serialize: function () {
    this.controller.serialize();
  },


};

