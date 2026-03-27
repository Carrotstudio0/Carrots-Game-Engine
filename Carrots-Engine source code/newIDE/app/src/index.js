// @flow
import 'element-closest';
// $FlowFixMe[missing-export]
import React, { Component, type Element } from 'react';
import ReactDOM from 'react-dom';
import Authentication from './Utils/GDevelopServices/Authentication';
import {
  sendProgramOpening,
  installAnalyticsEvents,
} from './Utils/Analytics/EventSender';
import { registerServiceWorker } from './ServiceWorkerSetup';
import './UI/icomoon-font.css'; // Styles for Icomoon font.
import optionalRequire from './Utils/OptionalRequire';
import { loadScript } from './Utils/LoadScript';
import { showErrorBox } from './UI/Messages/MessageBox';
import VersionMetadata from './Version/VersionMetadata';
import { loadPreferencesFromLocalStorage } from './MainFrame/Preferences/PreferencesProvider';
import { getFullTheme } from './UI/Theme';

const GD_STARTUP_TIMES = global.GD_STARTUP_TIMES || [];
// $FlowFixMe[cannot-resolve-name]
const PUBLIC_URL: string = process.env.PUBLIC_URL || '';
// $FlowFixMe[cannot-resolve-name]
const isDev = process.env.NODE_ENV !== 'production';
const publicAssetPrefix =
  PUBLIC_URL && PUBLIC_URL !== '.'
    ? PUBLIC_URL.replace(/\/$/, '')
    : '';
const libGdCacheBuster = isDev
  ? `${VersionMetadata.versionWithHash}-${Date.now()}`
  : VersionMetadata.versionWithHash;
const getVersionedPublicAssetPath = (fileName: string): string => {
  const normalizedFileName = (fileName || '').replace(/^\/+/, '');
  const query = `cache-buster=${libGdCacheBuster}`;
  const isFileProtocol =
    typeof window !== 'undefined' &&
    window.location &&
    window.location.protocol === 'file:';

  // In Electron (`file://`), absolute "/libGD.js" resolves to disk root and fails.
  // Keep paths relative to index.html so bundled runtime files are found.
  if (isFileProtocol || !!electron) {
    return `./${normalizedFileName}?${query}`;
  }

  if (publicAssetPrefix) {
    return `${publicAssetPrefix}/${normalizedFileName}?${query}`;
  }

  return `/${normalizedFileName}?${query}`;
};

// No i18n in this file

const electron = optionalRequire('electron');

// Make sure that the process object is available, even if we are not in Node.
// This is needed by some libraries like path-browserify for example.
// and it avoids hard crashes when using them.
global.process = global.process || {
  cwd: () => '/',
};

// Use the user preferred theme to define the loading screen color.

let color = 'f0f0f0';

try {
  const values = loadPreferencesFromLocalStorage();
  if (values && values.themeName) {
    const theme = getFullTheme({
      themeName: values.themeName,
      language: 'en', // language is not important here as we only look for a color.
      isMobile: true, // window size is not important as we only look for a color.
    });
    color = theme.gdevelopTheme.surface.window.backgroundColor;
  }
} catch {}

document.getElementsByTagName('body')[0].style.backgroundColor = color;

const styles = {
  loadingMessage: {
    position: 'absolute',
    top: 'calc(50% + 80px)',
    left: 15,
    right: 15,
    fontSize: 20,
    fontFamily: 'sans-serif',
    color: 'darkgray',
    textAlign: 'center',
    animation:
      'text-focus-in 0.5s cubic-bezier(0.215, 0.610, 0.355, 1.000) both',
  },
};

type State = {|
  loadingMessage: string,
  App: ?Element<any>,
|};

class Bootstrapper extends Component<{}, State> {
  // $FlowFixMe[missing-local-annot]
  state = {
    loadingMessage: '',
    App: null,
  };
  // $FlowFixMe[missing-local-annot]
  authentication = new Authentication();

  componentDidMount() {
    installAnalyticsEvents();
    GD_STARTUP_TIMES.push(['bootstrapperComponentDidMount', performance.now()]);

    // Load GDevelop.js, ensuring a new version is fetched when the version changes.
    loadScript(getVersionedPublicAssetPath('libGD.js')).then(
      () => {
        GD_STARTUP_TIMES.push(['libGDLoadedTime', performance.now()]);
        const initializeGDevelopJs = global.initializeGDevelopJs;
        if (!initializeGDevelopJs) {
          this.handleEditorLoadError(
            new Error('Missing initializeGDevelopJs in libGD.js')
          );
          return;
        }

        initializeGDevelopJs({
          // Override the resolved URL for the .wasm file,
          // to ensure a new version is fetched when the version changes.
          locateFile: (path: string) => {
            // This function is called by Emscripten to locate the .wasm file only.
            // Using the public root avoids resolving from nested/chunk paths.
            return getVersionedPublicAssetPath(path);
          },
        })
          .then(gd => {
            global.gd = gd;
            GD_STARTUP_TIMES.push([
              'libGD.js initialization done',
              performance.now(),
            ]);
            sendProgramOpening();

            if (electron) {
              import(/* webpackChunkName: "local-app" */ './LocalApp')
                .then(module =>
                  this.setState({
                    App: module.create(this.authentication),
                    loadingMessage: '',
                  })
                )
                .catch(this.handleEditorLoadError);
            } else {
              import(/* webpackChunkName: "browser-app" */ './BrowserApp')
                .then(module =>
                  this.setState({
                    App: module.create(this.authentication),
                    loadingMessage: '',
                  })
                )
                .catch(this.handleEditorLoadError);
            }
          })
          .catch(this.handleEditorLoadError);
      },
      this.handleEditorLoadError
    );
  }

  // $FlowFixMe[missing-local-annot]
  handleEditorLoadError = rawError => {
    const message = !electron
      ? 'Please check your internet connectivity, close the tab and reopen it.'
      : 'Please restart the application or reinstall the latest version if the problem persists.';

    this.setState({
      loadingMessage: `Unable to load GDevelop. ${message}`,
    });
    showErrorBox({
      message: `Unable to load GDevelop. ${message}`,
      rawError,
      errorId: 'editor-load-error',
    });
  };

  // $FlowFixMe[missing-local-annot]
  render() {
    const { App, loadingMessage } = this.state;

    return (
      <React.Fragment>
        {App}
        {loadingMessage && (
          <div style={styles.loadingMessage}>{loadingMessage}</div>
        )}
      </React.Fragment>
    );
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  GD_STARTUP_TIMES.push(['reactDOMRenderCall', performance.now()]);
  ReactDOM.render(<Bootstrapper />, rootElement);
} else console.error('No root element defined in index.html');

registerServiceWorker();
