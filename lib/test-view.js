/** @babel */
/** @jsx etch.dom */

import { CompositeDisposable } from 'atom';
import etch from 'etch';
import path from 'path';


export default class AtomPsqlTestView {

	constructor() {
		this.disposables = new CompositeDisposable();
		etch.initialize(this);
	}

	serialize() {
		return {
			deserializer: 'TerminalView'
		};
	}

	destroy() {
		// Detach from the DOM
		etch.destroy(this);

		// Dispose of Disposables
		this.disposables.dispose();

	}


	render() {
		return (
			<div>test ok</div>
		);
	}

	update() {
		return etch.update(this);
	}

	//
	clear() {
	}


	getDefaultLocation() {
		return 'bottom';
	}

	getIconName() {
		return 'terminal';
	}

	getTitle() {
		return 'TEST';
	}






}
