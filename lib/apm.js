"use babel";

import {BufferedProcess} from "atom";

export default class ApmController {

  function

  apm(args) {
    return new Promise(resolve => {
      const output = [], error = [];
      new BufferedProcess({
        command: atom.packages.getApmPath(),
        args,
        stdout: lines => output.push(lines),
        stderr: lines => error.push(lines),
        exit: code =>
          resolve({code, stdout: output.join("\n"), stderr: error.join("\n")})
      });
    });
  }

  apmInstall({name, version, theme,onSuccess}) {
    let notification1 = atom.notifications.addInfo('<b>PLEASE WAIT</b><br/>Installing required package: ' + name,{dismissable:true});
    if (atom.packages.isPackageActive(name)) {
      atom.packages.deactivatePackage(name);
    }
    if (atom.packages.isPackageLoaded(name)) {
      atom.packages.unloadPackage(name);
    }

    const packageRef = version ? `${name}@${version}` : name;
    return this.apm(["install", packageRef]).then(({code, stdout, stderr}) => {
      if (code === 0) {
        atom.packages.loadPackage(name);
        atom.packages.activatePackage(name);
        atom.notifications.addInfo(`Installing \u201C${packageRef}\u201D Success.`);
        if (onSuccess) {
          onSuccess(name,version,theme);
        }
      } else {
        atom.notifications.addError(`Installing \u201C${packageRef}\u201D failed.`);
        atom.notifications.addError(stderr);
      }
      notification1.dismiss();
    });
  }

}