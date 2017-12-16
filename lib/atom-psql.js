'use babel';
import fs from 'fs';
import SQLMetaProvider from './providers/sql-meta-provider';
import AtomPsqlController from './atom-psql-controller.js';
import install from 'atom-package-deps';
import PsqlHtmlView from "./atom-psql-html-view";



export default {

	controller: null,

	consumeToolBar(getToolBar) {
		let toolBar = getToolBar('atom-psql');
		this.controller.setToolBar(toolBar);
	},


	psqlHtmlViewDeserialize: function (data) {
		if (!data || !data['data']) {
			return null;
		}
		let view_data = data['data'];
		let filePath = view_data['filePath'];
		if (fs.existsSync(filePath)) {
			return new PsqlHtmlView(view_data);
		}
		return null;
	},

	activate(state) {
		console.log("atom-psql activate");
		install('atom-psql');//.then(function() { });
		this.controller = new AtomPsqlController(state);

	},


	provideAutocomplete: function () {
		return new SQLMetaProvider(this.controller);
	},


	deactivate() {
		this.controller.destroy();
	},


	serialize: function () {
		this.controller.serialize();
	},

	// deserializeTerminalView() {
	// 	return null;
	// },






	config: {
		"core": {
			type: 'object',
			order: 1,
			properties: {
				"conectOnStart": {
					type: "boolean",
					default: true,
					description: "initialize connection on startup based on psql environment variables"
				},
				"maximumSqlViewInKb": {
					type: "integer",
					default: 1000,
					minimum: 1,
					description: "The maximum sql view file size in Kb"
				},
			}
		},
		"views": {
			type: 'object',
			order: 2,
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
			order: 3,
			properties: {
				// "readFromNamedPipe":
				//   {
				//     type: "boolean",
				//     default:
				//       true,
				//     description:
				//       "If enabled, we read from Named Pipe file otherwise we use file watcher"
				//   }
				// ,
				"psqlCommand": {
					type: "string",
					default: "psql",
					description: "psql command"
				},
				"psqlPrompt1Regexp": {
					type: "string",
					default: "^‡\\w+:",
					description: "psql PROMPT1 regular expression.  this regexp must match to PROMPT1"
				},
				"psqlPrompt2Regexp": {
					type: "string",
					default: "^‡\\w+\\-",
					description: "psql PROMPT2 regular expression. this regexp must match to PROMPT2"
				},
				"psqlPagerStopSendCommand": {
					type: "string",
					default: "CTRL+C",
					description: "psql character sequence for sending to psql in order to stop the pager"
				},
				"PROMPT1": {
					type: "string",
					default: '‡%/: ',
					description: "psql variable PROMPT1  (needs reload)"
				},
				"PROMPT2": {
					type: "string",
					default: '‡%/- ',
					description: "psql variable PROMPT2 (needs reload)"
				},
				"PROMPT3": {
					type: "string",
					default: '_>> ',
					description: "psql variable PROMPT3 (needs reload)"
				},
				'terminalInsertDelay': {
					type: "integer",
					default: 400,
					description: "time delay on transfer to terminal, minimum value 200",
				},
				"echoQueries": {
					type: "boolean",
					default: true,
					description: 'inttial value for echo commands sent to server (--echo-queries) (apply on Reports)',
				}

			}
		},

		"toolbar": {
			type: 'object',
			order: 4,
			properties: {
				"displayToolbar": {
					type: "boolean",
					default: true,
					description: "display toolbar"
				},
				"initToolbarOnStart": {
					type: "boolean",
					default: true,
					description: "initialize toolbar on start"
				},
			},
		},


		"displayKeymapsInfoOnStart": {
			type: "boolean",
			default: true,
			description: "display keymaps help on start"
		},
	}
};

