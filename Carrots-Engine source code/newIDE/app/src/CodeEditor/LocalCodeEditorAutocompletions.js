//@flow
import optionalRequire from '../Utils/OptionalRequire';
const localGDJSFinder = optionalRequire('../GameEngineFinder/LocalGDJSFinder');
const findGDJS =
  localGDJSFinder && typeof localGDJSFinder.findGDJS === 'function'
    ? localGDJSFinder.findGDJS
    : null;
const fs = optionalRequire('fs');
const path = optionalRequire('path');
const process = optionalRequire('process');

// Avoid conflicts in declaration of PIXI and THREE namespaces.
const excludedFiles = [
  'global-three.d.ts',
  'global-pixi.d.ts',
  'pixi-particles-pixi-renderer.d.ts',
  'pixi-tilemap.d.ts',
  'pixi.js',
  'three.js',
];

export const setupAutocompletions = (monaco: any) => {
  const addExtraLibForJavaScriptAndTypeScript = (
    content: string,
    fullPath: string
  ) => {
    monaco.languages.typescript.javascriptDefaults.addExtraLib(content, fullPath);
    monaco.languages.typescript.typescriptDefaults.addExtraLib(content, fullPath);
  };

  const isExistingPath = (targetPath: string): boolean => {
    if (!targetPath || !fs) return false;
    try {
      return !!fs.existsSync(targetPath);
    } catch (error) {
      return false;
    }
  };

  const isExistingDirectory = (targetPath: string): boolean => {
    if (!isExistingPath(targetPath)) return false;
    try {
      return fs.lstatSync(targetPath).isDirectory();
    } catch (error) {
      return false;
    }
  };

  const findFirstExistingPath = (candidatePaths: Array<string>): string => {
    for (const candidatePath of candidatePaths) {
      if (isExistingPath(candidatePath)) return candidatePath;
    }
    return '';
  };

  const addExtraLibFromFile = (
    filePath: string,
    virtualPath: string
  ): void => {
    if (!filePath || !isExistingPath(filePath)) return;
    fs.readFile(filePath, 'utf8', (fileError, content) => {
      if (fileError) {
        console.error(
          `Unable to read ${filePath} for setting up autocompletions:`,
          fileError
        );
        return;
      }
      addExtraLibForJavaScriptAndTypeScript(content, virtualPath);
    });
  };

  const importAllJsFilesFromFolder = (folderPath: string) => {
    if (!isExistingDirectory(folderPath)) return;
    fs.readdir(folderPath, (error: ?Error, filenames: Array<string>) => {
      if (error) {
        console.error(
          'Unable to read GDJS files for setting up autocompletions:',
          error
        );
        return;
      }

      filenames.forEach(filename => {
        const fullPath = path.join(folderPath, filename);
        let isDirectory = false;
        try {
          isDirectory = fs.lstatSync(fullPath).isDirectory();
        } catch (error) {
          return;
        }
        if (
          (filename.endsWith('.ts') || filename.endsWith('.js')) &&
          !excludedFiles.includes(filename) &&
          // Dialogue tree uses a folder called `bondage.js` that should not be read as a file.
          !isDirectory
        ) {
          fs.readFile(fullPath, 'utf8', (fileError, content) => {
            if (fileError) {
              console.error(
                `Unable to read ${fullPath} for setting up autocompletions:`,
                fileError
              );
              return;
            }

            addExtraLibForJavaScriptAndTypeScript(content, fullPath);
          });
        }
      });
    });
  };

  // $FlowFixMe[recursive-definition]
  const importAllJsFilesFromFolderRecursively = (folderPath: string) => {
    if (!isExistingDirectory(folderPath)) return;
    fs.readdir(folderPath, (error: ?Error, filenames: Array<string>) => {
      if (error) {
        console.error(
          'Unable to read GDJS files for setting up autocompletions:',
          error
        );
        return;
      }

      filenames.forEach(filename => {
        const fullPath = path.join(folderPath, filename);
        let isDirectory = false;
        try {
          isDirectory = fs.lstatSync(fullPath).isDirectory();
        } catch (error) {
          return;
        }
        if (isDirectory) {
          importAllJsFilesFromFolderRecursively(fullPath);
        } else if (filename.endsWith('.ts') || filename.endsWith('.js')) {
          fs.readFile(fullPath, 'utf8', (fileError, content) => {
            if (fileError) {
              console.error(
                `Unable to read ${fullPath} for setting up autocompletions:`,
                fileError
              );
              return;
            }

            addExtraLibForJavaScriptAndTypeScript(content, fullPath);
          });
        }
      });
    });
  };

  const addDefaultEventContextAutocompletions = () => {
    addExtraLibForJavaScriptAndTypeScript(
      `
declare namespace gdjs {
  interface RuntimeScene {}
  interface RuntimeObject {
    getBehavior(name: string): RuntimeBehavior;
  }
  interface RuntimeBehavior {
    owner: RuntimeObject;
  }
  const evtTools: any;
}

interface EventsFunctionContext {}
`,
      'gdevelop://fallback/runtime-minimal-types.d.ts'
    );
    addExtraLibForJavaScriptAndTypeScript(
      `
/** Represents the scene being played. */
var runtimeScene = new gdjs.RuntimeScene();

/**
 * The instances of objects that are passed to your JavaScript function.
 * @type {gdjs.RuntimeObject[]}
 */
var objects = [];

/**
 * @type {EventsFunctionContext}
 */
var eventsFunctionContext = {};

/**
 * @type {typeof gdjs.evtTools}
 */
var evtTools = gdjs.evtTools;
`,
      'this-mock-the-context-of-events.js'
    );
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      `
declare const runtimeScene: gdjs.RuntimeScene;
declare const objects: gdjs.RuntimeObject[];
declare const eventsFunctionContext: EventsFunctionContext;
declare const evtTools: typeof gdjs.evtTools;
`,
      'this-mock-the-context-of-events.d.ts'
    );
  };

  if (!fs || !path || !findGDJS) {
    addDefaultEventContextAutocompletions();
    return;
  }

  findGDJS()
    .then(({ gdjsRoot }) => {
    // Autocompletions are generated by reading the sources of the game engine
    // (much like how autocompletions work in Visual Studio Code) - *not* the built files.
    // The built files are stripped of their types and documentation, so it would
    // not work.
    //
    // We could also use the TypeScript compiler to emit .d.ts files when building GDJS,
    // but this would make TypeScript slower (at least 2x slower) and we would still need
    // to copy and read an equivalent number of files.
    const runtimePath = findFirstExistingPath([
      path.join(gdjsRoot, 'Runtime-sources'),
      path.join(gdjsRoot, 'Runtime'),
    ]);
    if (!runtimePath) {
      addDefaultEventContextAutocompletions();
      return;
    }
    const runtimeTypesPath = path.join(runtimePath, 'types');
    const runtimeLibsPath = path.join(runtimePath, 'libs');
    const runtimePixiRenderersPath = path.join(runtimePath, 'pixi-renderers');
    const runtimeHowlerSoundManagerPath = path.join(
      runtimePath,
      'howler-sound-manager'
    );
    const runtimeFontfaceobserverFontManagerPath = path.join(
      runtimePath,
      'fontfaceobserver-font-manager'
    );
    const extensionsPath = findFirstExistingPath([
      path.join(runtimePath, 'Extensions'),
      path.join(gdjsRoot, 'Extensions'),
      path.join(gdjsRoot, 'GDJS', 'Extensions'),
    ]);
    const eventToolsPath = path.join(runtimePath, 'events-tools');
    const threeTypesPath = path.join(runtimeTypesPath, 'three');
    const pixiTypesPath = path.join(runtimeTypesPath, 'pixi');
    const gdevelopTypesPath =
      process && process.cwd
        ? findFirstExistingPath([
            path.join(runtimeTypesPath, 'global-types.d.ts'),
            path.join(gdjsRoot, 'GDevelop.js', 'types.d.ts'),
            path.join(process.cwd(), 'GDevelop.js', 'types.d.ts'),
            path.join(process.cwd(), 'GDJS', 'Runtime', 'types', 'global-types.d.ts'),
            path.join(
              process.cwd(),
              '..',
              'GDJS',
              'Runtime',
              'types',
              'global-types.d.ts'
            ),
            path.join(
              process.cwd(),
              '..',
              '..',
              'GDJS',
              'Runtime',
              'types',
              'global-types.d.ts'
            ),
          ])
        : '';

    importAllJsFilesFromFolder(runtimePath);
    importAllJsFilesFromFolder(runtimeTypesPath);
    importAllJsFilesFromFolder(runtimeLibsPath);
    importAllJsFilesFromFolder(runtimePixiRenderersPath);
    importAllJsFilesFromFolder(runtimeHowlerSoundManagerPath);
    importAllJsFilesFromFolder(runtimeFontfaceobserverFontManagerPath);
    importAllJsFilesFromFolder(eventToolsPath);
    importAllJsFilesFromFolderRecursively(threeTypesPath);
    importAllJsFilesFromFolderRecursively(pixiTypesPath);
    addExtraLibFromFile(gdevelopTypesPath, 'gdevelop://bindings/types.d.ts');

    if (!extensionsPath || !isExistingDirectory(extensionsPath)) {
      addDefaultEventContextAutocompletions();
      return;
    }

    fs.readdir(extensionsPath, (error: ?Error, folderNames: Array<string>) => {
      if (error) {
        console.error(
          'Unable to read Extensions folders for setting up autocompletions:',
          error
        );
        return;
      }

      folderNames
        .filter(
          folderName =>
            !folderName.endsWith('.txt') &&
            !folderName.endsWith('.md') &&
            !folderName.endsWith('.flow.js') &&
            !folderName.endsWith('.d.ts') &&
            !folderName.endsWith('.gitignore')
        )
        .forEach(folderName =>
          importAllJsFilesFromFolder(path.join(extensionsPath, folderName))
        );
    });

      addDefaultEventContextAutocompletions();
    })
    .catch(error => {
      console.warn('Unable to setup local GDJS autocompletions.', error);
      addDefaultEventContextAutocompletions();
    });
};
