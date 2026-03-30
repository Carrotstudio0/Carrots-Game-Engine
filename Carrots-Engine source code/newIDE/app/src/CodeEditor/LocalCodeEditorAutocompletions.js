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
    getAllBehaviors(): RuntimeBehavior[];
    getAllBehaviorNames(): string[];
    getBehaviorByType(behaviorType: string): RuntimeBehavior | null;
    getBehaviorsByType(behaviorType: string): RuntimeBehavior[];
  }
  interface RuntimeBehavior {
    owner: RuntimeObject;
    type: string;
    getName(): string;
    activated(): boolean;
  }
  function getRegisteredObjectTypes(): string[];
  function getRegisteredBehaviorTypes(): string[];
  function getRegisteredExtensionNames(): string[];
  namespace runtimeCapabilities {
    function getRuntimeCapabilitiesSummary(): any;
    function listObjectBehaviors(object: RuntimeObject): any[];
    function resolveBehavior(
      object: RuntimeObject,
      behaviorNameOrType: string
    ): any;
    function listBehaviorMethods(
      object: RuntimeObject,
      behaviorNameOrType: string
    ): string[];
    function invokeBehaviorMethod(
      object: RuntimeObject,
      behaviorNameOrType: string,
      methodName: string,
      ...args: any[]
    ): any;
    function registerBehaviorCapability(capability: any): void;
    function unregisterBehaviorCapability(
      behaviorType: string,
      methodName?: string
    ): void;
    function listRegisteredBehaviorCapabilityTypes(): string[];
    function registerExtensionCapability(capability: any): void;
    function registerExtensionNamespace(
      extensionName: string,
      extensionNamespace: any
    ): void;
    function autoRegisterKnownExtensionNamespaces(): void;
    function unregisterExtensionCapability(
      extensionName: string,
      methodName?: string
    ): void;
    function listRegisteredExtensionCapabilityNames(): string[];
    function listExtensionMethods(extensionName: string): string[];
    function invokeExtensionMethod(
      extensionName: string,
      methodName: string,
      ...args: any[]
    ): any;
    function bindManualExtensionToObject(
      object: RuntimeObject,
      binding: any
    ): void;
    function unbindManualExtensionFromObject(
      object: RuntimeObject,
      extensionName: string
    ): boolean;
    function listManualObjectExtensions(object: RuntimeObject): string[];
    function setManualObjectExtensionConfig(
      object: RuntimeObject,
      extensionName: string,
      configPatch: { [key: string]: unknown }
    ): boolean;
    function getManualObjectExtensionConfig(
      object: RuntimeObject,
      extensionName: string
    ): { [key: string]: unknown } | null;
    function invokeManualObjectExtensionMethod(
      object: RuntimeObject,
      extensionName: string,
      methodName: string,
      ...args: any[]
    ): any;
    function invokeObjectExtensionMethod(
      object: RuntimeObject,
      extensionName: string,
      methodName: string,
      ...args: any[]
    ): any;
    function getEngineAccess(source?: any): any;
    function readEnginePath(path: string, source?: any): any;
    function invokeEnginePath(path: string, source?: any, ...args: any[]): any;
    function getInputSnapshot(source?: any): any;
    function listPressedKeys(source?: any): number[];
    function listActiveTouches(source?: any): any[];
    function listConnectedGamepads(): any[];
    function setKeyPressed(
      source: any,
      keyCode: number,
      location?: number
    ): boolean;
    function setKeyReleased(
      source: any,
      keyCode: number,
      location?: number
    ): boolean;
    function setMousePosition(
      source: any,
      x: number,
      y: number,
      movementX?: number,
      movementY?: number
    ): boolean;
    function setMouseButtonPressed(source: any, buttonCode: number): boolean;
    function setMouseButtonReleased(source: any, buttonCode: number): boolean;
    function setMouseWheelDelta(
      source: any,
      deltaY: number,
      deltaX?: number,
      deltaZ?: number
    ): boolean;
    function setTouchStarted(
      source: any,
      rawIdentifier: number,
      x: number,
      y: number
    ): boolean;
    function setTouchMoved(
      source: any,
      rawIdentifier: number,
      x: number,
      y: number
    ): boolean;
    function setTouchEnded(source: any, rawIdentifier: number): boolean;
    function setTouchSimulationForMouse(source: any, enable: boolean): boolean;
  }
  namespace variables {
    const scene: any;
    const global: any;
    const object: any;
  }
  const evtTools: any;
  namespace ts {
    const bridge: typeof tsModules;
    function setExternalModule(moduleName: string, moduleValue: any): void;
    function setExternalModuleAlias(moduleName: string, globalPath: string): void;
    function requireExternalModule(moduleName: string): any;
    function importExternalModule(moduleName: string): Promise<any>;
    function resolveGlobal(globalPath: string): any;
    function bindDefaultExternalModules(): void;
    function requireModule(moduleName: string): any;
    function callScriptExport(
      moduleId: string,
      exportName?: string,
      ...args: any[]
    ): any;
    function setSharedState(key: string, value: any): void;
    function getSharedState(key: string, defaultValue?: any): any;
    function emit(eventName: string, payload?: any): number;
    function on(
      eventName: string,
      listener: (payload?: any, metadata?: any) => any
    ): () => void;
    function off(
      eventName: string,
      listener?: (payload?: any, metadata?: any) => any
    ): number;
    function registerProjectBehavior(
      behaviorType: string,
      behaviorConstructor: typeof RuntimeBehavior
    ): void;
    function evalJavaScript(code: string): any;
    function test(testName: string, testFunction: () => void): void;
    function runTests(): {
      total: number;
      passed: number;
      failed: number;
      failures: Array<{ name: string; message: string }>;
    };
    function clearTests(): void;
  }
}

interface EventsFunctionContext {}

declare const tsModules: {
  setExternal(moduleName: string, moduleValue: any): void;
  setExternalAlias(moduleName: string, globalPath: string): void;
  hasExternal(moduleName: string): boolean;
  getExternal(moduleName: string): any;
  requireExternal(moduleName: string): any;
  importExternal(moduleName: string): Promise<any>;
  resolveGlobal(globalPath: string): any;
  bindDefaultExternals(): void;
  listModuleIds(): string[];
  callExport(moduleId: string, exportName?: string, ...args: any[]): any;
  hasSharedState(key: string): boolean;
  setSharedState(key: string, value: any): void;
  getSharedState(key: string, defaultValue?: any): any;
  deleteSharedState(key: string): boolean;
  patchSharedState(key: string, patchValue: any): any;
  clearSharedState(): void;
  listSharedStateKeys(): string[];
  on(eventName: string, listener: (payload?: any, metadata?: any) => any): () => void;
  once(eventName: string, listener: (payload?: any, metadata?: any) => any): () => void;
  off(
    eventName: string,
    listener?: (payload?: any, metadata?: any) => any
  ): number;
  emit(eventName: string, payload?: any): number;
  clearEventListeners(eventName?: string): number;
  listEventNames(): string[];
  require(moduleName: string): any;
  evalJavaScript(code: string): any;
  registerTest(testName: string, testFunction: () => void): void;
  runTests(): {
    total: number;
    passed: number;
    failed: number;
    failures: Array<{ name: string; message: string }>;
  };
  clearTests(): void;
};
declare function registerProjectBehavior(
  behaviorType: string,
  behaviorConstructor: typeof gdjs.RuntimeBehavior
): void;
declare function requireModule(moduleName: string): any;
declare function callScriptExport(
  moduleId: string,
  exportName?: string,
  ...args: any[]
): any;
declare function setScriptSharedState(key: string, value: any): void;
declare function getScriptSharedState(key: string, defaultValue?: any): any;
declare function emitScriptEvent(eventName: string, payload?: any): number;
declare function onScriptEvent(
  eventName: string,
  listener: (payload?: any, metadata?: any) => any
): () => void;
declare function offScriptEvent(
  eventName: string,
  listener?: (payload?: any, metadata?: any) => any
): number;
declare function requireExternalModule(moduleName: string): any;
declare function importExternalModule(moduleName: string): Promise<any>;
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
