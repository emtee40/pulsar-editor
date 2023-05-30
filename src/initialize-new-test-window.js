const ipcHelpers = require('./ipc-helpers');
const { addAtomExport } = require('./module-utils');
const fs = require('fs');
const path = require('path');
const vm = require('vm')
const {glob} = require('glob');

module.exports = async function({ blobStore, globalAtom }) {
  const { remote } = require('electron');
  const getWindowLoadSettings = require('./get-window-load-settings');

  const exitWithStatusCode = function(status) {
    remote.app.emit('will-quit');
    remote.process.exit(status);
  };

  try {
    const path = require('path');
    const { ipcRenderer } = require('electron');
    const CompileCache = require('./compile-cache');
    const { updateProcessEnv } = require('./update-process-env');
    require('./electron-shims');

    ipcRenderer.on('environment', (event, env) => updateProcessEnv(env));

    const {
      testRunnerPath,
      headless,
      logFile,
      testPaths,
      env
    } = getWindowLoadSettings();

    if (headless) {
      // Install console functions that output to stdout and stderr.
      const util = require('util');

      Object.defineProperties(process, {
        stdout: { value: remote.process.stdout },
        stderr: { value: remote.process.stderr }
      });

      console.log = (...args) =>
        process.stdout.write(`${util.format(...args)}\n`);
      console.error = (...args) =>
        process.stderr.write(`${util.format(...args)}\n`);
    } else {
      // Show window synchronously so a focusout doesn't fire on input elements
      // that are focused in the very first spec run.
      remote.getCurrentWindow().show();
    }

    const handleKeydown = function(event) {
      // Reload: cmd-r / ctrl-r
      if ((event.metaKey || event.ctrlKey) && event.keyCode === 82) {
        ipcHelpers.call('window-method', 'reload');
      }

      // Toggle Dev Tools: cmd-alt-i (Mac) / ctrl-shift-i (Linux/Windows)
      if (
        event.keyCode === 73 &&
        ((process.platform === 'darwin' && event.metaKey && event.altKey) ||
          (process.platform !== 'darwin' && event.ctrlKey && event.shiftKey))
      ) {
        ipcHelpers.call('window-method', 'toggleDevTools');
      }

      // Close: cmd-w / ctrl-w
      if ((event.metaKey || event.ctrlKey) && event.keyCode === 87) {
        ipcHelpers.call('window-method', 'close');
      }

      // Copy: cmd-c / ctrl-c
      if ((event.metaKey || event.ctrlKey) && event.keyCode === 67) {
        atom.clipboard.write(window.getSelection().toString());
      }
    };

    window.addEventListener('keydown', handleKeydown, { capture: true });

    // Set up optional transpilation for packages under test if any
    const FindParentDir = require('find-parent-dir');
    const packageRoot = FindParentDir.sync(testPaths[0], 'package.json');
    if (packageRoot) {
      const packageMetadata = require(path.join(packageRoot, 'package.json'));
      if (packageMetadata.atomTranspilers) {
        CompileCache.addTranspilerConfigForPath(
          packageRoot,
          packageMetadata.name,
          packageMetadata,
          packageMetadata.atomTranspilers
        );
      }
    }

    document.title = 'Test Suite';

    // const testRunner = requireModule(testRunnerPath);
    const buildDefaultApplicationDelegate = () => new ApplicationDelegate();
    genAtomGlobal(blobStore)
    updateProcessEnv(env);
    // Set load paths for the package's test runner
    let loadPaths = vm.runInThisContext('module.paths')
    testPaths.forEach(testPath => {
      let currentPath = testPath;
      while(currentPath !== path.dirname(currentPath)) {
        const modulesPath = path.join(currentPath, 'node_modules')
        if(fs.existsSync(modulesPath)) {
          loadPaths.unshift(modulesPath)
        }
        currentPath = path.dirname(currentPath);
      }
    })

    const rootDiv = prepareUI();
    runAllTests({rootDiv, blobStore, testPaths});
  } catch (error) {
    console.error(error.stack)
    throw error;
  }
}

let testDiv
function prepareUI() {
  const div = document.createElement('div');
  div.style.display = 'flex';
  div.style.width = '100%'
  div.style.height = '100%'

  const testPanel = document.createElement('atom-panel');
  testPanel.classList.add('padded', 'tool-panel');
  div.append(testPanel);

  testDiv = document.createElement('div');
  testDiv.classList.add('tests', 'padded', 'block');
  testDiv.style.height = '100%'
  testDiv.style.overflow = 'auto'
  testPanel.append(testDiv);

  const workspace = atom.views.getView(atom.workspace);
  workspace.style.width = '100%'
  workspace.style.height = '100%'
  div.append(workspace);
  document.body.append(div);
  return div
}

const atomExported = require('atom')
let mocha
let watchers = []

async function runAllTests({rootDiv, blobStore, testPaths}) {
  vm.runInThisContext('var Mocha = require("mocha")')
  const Reporter = require('./mocha-test-runner/reporter')
  Reporter.setMocha(Mocha)

  mocha?.unloadFiles()
  mocha = new Mocha();
  mocha.reporter(Reporter);

  const promises = testPaths.flatMap(async path => {
    const files = await glob(
      `${path}/**/*{spec,test}.{js,coffee,ts,cjs,jsx,mjs}`,
      { ignore: 'node_modules/**' }
    );
    return files.map(file => {
      mocha.addFile(file)
      return atomExported.watchPath(file, {}, () => {
        runTests(rootDiv, blobStore, [file])
      });
    });
  })
  watchers = await Promise.all(promises)
  mocha.run();
}

async function runTests(rootDiv, blobStore, testFiles) {
  atom.views.getView(atom.workspace).remove();
  genAtomGlobal(blobStore)
  const workspace = atom.views.getView(atom.workspace)
  workspace.style.width = '100%'
  workspace.style.height = '100%'
  rootDiv.append(workspace);

  const Reporter = require('./mocha-test-runner/reporter')
  Reporter.setMocha(Mocha)

  mocha?.unloadFiles()
  mocha = new Mocha();
  mocha.reporter(Reporter);
  testFiles.forEach(file => mocha.addFile(file))

  testDiv.innerHTML = ''
  mocha.run();
}

function genAtomGlobal(blobStore) {
  delete window.atom

  const TextEditor = require('../src/text-editor');
  const Clipboard = require('../src/clipboard');
  const clipboard = new Clipboard();
  TextEditor.setClipboard(clipboard);
  TextEditor.viewForItem = item => atom.views.getView(item);

  const ApplicationDelegate = require('../src/application-delegate');
  const AtomEnvironment = require('../src/atom-environment');
  const buildAtomEnvironment = function(params) {
    // params = Object.create(params);
    if (!params.hasOwnProperty('clipboard')) {
      params.clipboard = clipboard;
    }
    if (!params.hasOwnProperty('blobStore')) {
      params.blobStore = blobStore;
    }
    if (!params.hasOwnProperty('onlyLoadBaseStyleSheets')) {
      params.onlyLoadBaseStyleSheets = true;
    }
    const atomEnvironment = new AtomEnvironment(params);
    atomEnvironment.initialize(params);
    TextEditor.setScheduler(atomEnvironment.views);
    return atomEnvironment;
  };

  const applicationDelegate = new ApplicationDelegate();
  applicationDelegate.setRepresentedFilename = function() {};
  applicationDelegate.setWindowDocumentEdited = function() {};
  window.atom = buildAtomEnvironment({
    applicationDelegate, window, document,
    configDirPath: process.env.ATOM_HOME
  })
  addAtomExport(window.atom);
  atom.packages.serviceHub.provide('pulsar.api', '0.1.0', {
    moduleName: '@pulsar/test', exports: require('./mocha-test-runner/helpers')
  })
}
