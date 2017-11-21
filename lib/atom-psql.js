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
    this.controller = new AtomPsqlController(state);

  },

  provideAutocomplete: function () {
    return new SQLMetaProvider(this.controller);
  },

  consumeTerminalService(service) {
    this.controller.setTerminalService(service);
  },

  deactivate() {
    this.controller.destroy();
  },


  serialize: function () {
    this.controller.serialize();
  },


  config: {
    "views": {
      type: 'object',
      order: 1,
      properties: {
        "maximumSqlViews": {
          type: "integer",
          default: 4,
          minimum: 1,
          description: "The maximum number of sql view tabs before we start removing old ones"
        },
        "maximumSqlViewInKb": {
          type: "integer",
          default: 1000,
          minimum: 1,
          description: "The maximum sql view file size in Kb"
        },
      }
    },
    "psql": {
      type: 'object',
      order: 2,
      properties: {
        "readFromNamedPipe": {
          type: "boolean",
          default: true,
          description: "If enabled, we read from Named Pipe file otherwise we use file watcher"
        },
        "psqlCommand": {
          type: "string",
          default: "psql",
          description: "psql command"
        },
        "psqlPromptRegexp": {
          type: "string",
          default: "^‡\\w+:",
          description: "psql normal prompt regular expression (in order to find if pager is active) this regexp must match to PROMPT1"
        },
        "psqlPagerStopSendCommand": {
          type: "string",
          default: "CTRL+C",
          description: "psql character sequence for sending to psql in order to stop the pager"
        },
        "PROMPT1":{
          type: "string",
          default: '‡%/: ',
          description: "psql variable PROMPT1  (needs reload)"
        },
        "PROMPT2":{
          type: "string",
          default: '_%/- ',
          description: "psql variable PROMPT2 (needs reload)"
        },
        "PROMPT3":{
          type: "string",
          default: '_>> ',
          description: "psql variable PROMPT3 (needs reload)"
        },
        "echoFailedCommands": {
          type: "boolean",
          default: true,
          description: 'echo failed commands (--echo-errors)',
        },
        "echoAllInput":{
          type: "boolean",
          default: true,
          description: 'echo all input from script, echo commands sent to server  (--echo-all --echo-queries)',

        }

      }
    }
  }

};

