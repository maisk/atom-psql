'use babel';

import AtomPsql from './lib/atom-psql';

// Use the command `window:run-package-specs` (cmd-alt-ctrl-p) to run specs.
//
// To run a specific `it` or `describe` block add an `f` to the front (e.g. `fit`
// or `fdescribe`). Remove the `f` to unfocus the block.

describe('AtomPsql', () => {
  let workspaceElement, activationPromise;

  beforeEach(() => {
    workspaceElement = atom.views.getView(atom.workspace);
    activationPromise = atom.packages.activatePackage('atom-psql');
  });

  describe('when the atom-psql:toggle event is triggered', () => {
    it('hides and shows the modal panel', () => {
      // Before the activation event the view is not on the DOM, and no panel
      // has been created
      expect(workspaceElement.querySelector('.atom-psql')).not.toExist();

      // This is an activation event, triggering it will cause the package to be
      // activated.
      atom.commands.dispatch(workspaceElement, 'atom-psql:toggle');

      waitsForPromise(() => {
        return activationPromise;
      });

      runs(() => {
        expect(workspaceElement.querySelector('.atom-psql')).toExist();

        let atomPsqlElement = workspaceElement.querySelector('.atom-psql');
        expect(atomPsqlElement).toExist();

        let atomPsqlPanel = atom.workspace.panelForItem(atomPsqlElement);
        expect(atomPsqlPanel.isVisible()).toBe(true);
        atom.commands.dispatch(workspaceElement, 'atom-psql:toggle');
        expect(atomPsqlPanel.isVisible()).toBe(false);
      });
    });

    it('hides and shows the view', () => {
      // This test shows you an integration test testing at the view level.

      // Attaching the workspaceElement to the DOM is required to allow the
      // `toBeVisible()` matchers to work. Anything testing visibility or focus
      // requires that the workspaceElement is on the DOM. Tests that attach the
      // workspaceElement to the DOM are generally slower than those off DOM.
      jasmine.attachToDOM(workspaceElement);

      expect(workspaceElement.querySelector('.atom-psql')).not.toExist();

      // This is an activation event, triggering it causes the package to be
      // activated.
      atom.commands.dispatch(workspaceElement, 'atom-psql:toggle');

      waitsForPromise(() => {
        return activationPromise;
      });

      runs(() => {
        // Now we can test for view visibility
        let atomPsqlElement = workspaceElement.querySelector('.atom-psql');
        expect(atomPsqlElement).toBeVisible();
        atom.commands.dispatch(workspaceElement, 'atom-psql:toggle');
        expect(atomPsqlElement).not.toBeVisible();
      });
    });
  });
});
