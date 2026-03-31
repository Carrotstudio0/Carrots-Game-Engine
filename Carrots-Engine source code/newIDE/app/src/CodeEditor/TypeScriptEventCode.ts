export type CodeLanguage = 'javascript' | 'typescript';
export type TypeScriptDiagnostic = {
  message: string;
  filePath: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

type TypeScriptModule = {
  transpileModule: (source: string, options: unknown) => any;
  ModuleKind: {
    None: number;
    CommonJS: number;
  };
  ScriptTarget: {
    ES2017: number;
  };
  DiagnosticCategory: {
    Error: number;
  };
  flattenDiagnosticMessageText: (
    messageText: unknown,
    newLine: string
  ) => string;
};

export type TypeScriptTranspilationResult = {
  transpiledJavaScriptCode: string;
  errorMessage: string | null;
  diagnostics: Array<TypeScriptDiagnostic>;
};

export type TypeScriptTranspileOptions = {
  moduleKind?: 'none' | 'commonjs';
  inlineSourceMap?: boolean;
  fileName?: string;
};

type PendingTypeScriptWorkerRequest = {
  resolve: (result: TypeScriptTranspilationResult) => void;
  reject: (error: Error) => void;
};

type TypeScriptWorkerResponse =
  | {
      type: 'DONE';
      requestId: number;
      result: TypeScriptTranspilationResult;
    }
  | {
      type: 'ERROR';
      requestId: number;
      message: string;
    };

const TYPE_SCRIPT_SOURCE_PREFIX = '//__GDEVELOP_TS_SOURCE_BASE64__:';

let typeScriptModulePromise: Promise<TypeScriptModule> | null = null;
let typeScriptCompilerWorker: Worker | null = null;
let nextTypeScriptWorkerRequestId = 1;
let hasLoggedWorkerFallback = false;
const pendingTypeScriptWorkerRequests = new Map<
  number,
  PendingTypeScriptWorkerRequest
>();

const createTypeScriptCompilerWorker = (): Worker =>
  new Worker(new URL('./TypeScriptCompiler.worker.js', import.meta.url));

const GDEVELOP_COMPILER_AMBIENT_DECLARATIONS = `
declare namespace gdjs {
  class RuntimeScene {}
  class RuntimeObject {
    getBehavior(name: string): RuntimeBehavior;
    getAllBehaviors(): RuntimeBehavior[];
    getAllBehaviorNames(): string[];
    getBehaviorByType(behaviorType: string): RuntimeBehavior | null;
    getBehaviorsByType(behaviorType: string): RuntimeBehavior[];
  }
  class RuntimeBehavior {
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
  namespace cinematicTimeline {
    function loadFromJson(runtimeScene: RuntimeScene, jsonString: string): void;
    function loadFromProjectStorage(
      runtimeScene: RuntimeScene,
      sceneName?: string
    ): void;
    function loadAndPlayFromProjectStorage(
      runtimeScene: RuntimeScene,
      sceneName?: string
    ): void;
    function saveLoadedToProjectStorage(
      runtimeScene: RuntimeScene,
      sceneName?: string
    ): void;
    function play(runtimeScene: RuntimeScene): void;
    function pause(runtimeScene: RuntimeScene): void;
    function stop(runtimeScene: RuntimeScene): void;
    function setCurrentFrame(runtimeScene: RuntimeScene, frame: number): void;
    function isPlaying(runtimeScene: RuntimeScene): boolean;
    function hasLoadedScene(runtimeScene: RuntimeScene): boolean;
    function hasSceneInProjectStorage(
      runtimeScene: RuntimeScene,
      sceneName: string
    ): boolean;
  }
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

declare const sceneObjects: { [name: string]: gdjs.RuntimeObject[] };
declare const scene: gdjs.RuntimeScene;
declare const evtTools: typeof gdjs.evtTools;

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

declare type __GDevelopProjectObjectLists = {
  [name: string]: gdjs.RuntimeObject[];
};
declare type __GDevelopProjectBehaviorByName = {
  [name: string]: gdjs.RuntimeBehavior;
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
declare function liveRepl(code: string): any;
`;

const appendCompilerAmbientDeclarations = (source: string): string =>
  `${source || ''}\n\n${GDEVELOP_COMPILER_AMBIENT_DECLARATIONS}`;

const encodeBase64 = (text: string): string => {
  if (typeof btoa !== 'function') return '';
  if (typeof TextEncoder === 'undefined') return btoa(text);

  const encoded = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < encoded.length; i++) {
    binary += String.fromCharCode(encoded[i]);
  }
  return btoa(binary);
};

const decodeBase64 = (encodedText: string): string | null => {
  try {
    if (typeof atob !== 'function') return null;
    const binary = atob(encodedText);
    if (typeof TextDecoder === 'undefined') return binary;

    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch (error) {
    return null;
  }
};

const loadTypeScript = async (): Promise<TypeScriptModule> => {
  if (!typeScriptModulePromise) {
    typeScriptModulePromise = import(
      /* webpackChunkName: "typescript-compiler" */ 'typescript'
    ).then(module => {
      const resolvedModule = (module.default || module) as TypeScriptModule;
      return resolvedModule;
    });
  }
  return typeScriptModulePromise;
};

const getDiagnosticErrorMessage = (
  typeScript: TypeScriptModule,
  diagnostic: any
): string => {
  const message = typeScript.flattenDiagnosticMessageText(
    diagnostic.messageText,
    '\n'
  );
  if (!diagnostic.file || typeof diagnostic.start !== 'number') return message;

  const position = diagnostic.file.getLineAndCharacterOfPosition(
    diagnostic.start
  );
  const filePath =
    diagnostic.file && typeof diagnostic.file.fileName === 'string'
      ? diagnostic.file.fileName
      : '';
  return `${filePath}:${position.line + 1}:${position.character + 1} ${message}`;
};

const toTypeScriptDiagnostic = (
  typeScript: TypeScriptModule,
  diagnostic: any
): TypeScriptDiagnostic => {
  const message = typeScript.flattenDiagnosticMessageText(
    diagnostic.messageText,
    '\n'
  );

  if (!diagnostic.file || typeof diagnostic.start !== 'number') {
    return {
      message,
      filePath: '',
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1,
    };
  }

  const startPosition = diagnostic.file.getLineAndCharacterOfPosition(
    diagnostic.start
  );
  const endPosition = diagnostic.file.getLineAndCharacterOfPosition(
    diagnostic.start + (diagnostic.length || 1)
  );

  return {
    message,
    filePath:
      diagnostic.file && typeof diagnostic.file.fileName === 'string'
        ? diagnostic.file.fileName
        : '',
    startLineNumber: startPosition.line + 1,
    startColumn: startPosition.character + 1,
    endLineNumber: endPosition.line + 1,
    endColumn: endPosition.character + 1,
  };
};

const transpileTypeScriptCodeOnMainThread = async (
  typeScriptSource: string,
  options?: TypeScriptTranspileOptions
): Promise<TypeScriptTranspilationResult> => {
  try {
    const typeScript = await loadTypeScript();
    const moduleKind =
      options && options.moduleKind === 'commonjs'
        ? typeScript.ModuleKind.CommonJS
        : typeScript.ModuleKind.None;
    const transpilationInput =
      appendCompilerAmbientDeclarations(typeScriptSource);
    const transpiled = typeScript.transpileModule(transpilationInput, {
      compilerOptions: {
        module: moduleKind,
        target: typeScript.ScriptTarget.ES2017,
        allowJs: false,
        sourceMap: !!options?.inlineSourceMap,
        inlineSources: !!options?.inlineSourceMap,
      },
      fileName: options?.fileName || 'script.ts',
      reportDiagnostics: true,
    });

    const diagnostics = transpiled.diagnostics || [];
    const errorDiagnostics = diagnostics.filter(
      (diagnostic: any) =>
        diagnostic.category === typeScript.DiagnosticCategory.Error
    );
    const diagnosticError = diagnostics.find(
      (diagnostic: any) =>
        diagnostic.category === typeScript.DiagnosticCategory.Error
    );

    let transpiledJavaScriptCode = transpiled.outputText || '';
    if (options?.inlineSourceMap && transpiled.sourceMapText) {
      transpiledJavaScriptCode = transpiledJavaScriptCode.replace(
        /\n\/\/# sourceMappingURL=.*$/g,
        ''
      );
      const encodedSourceMap = encodeBase64(transpiled.sourceMapText);
      if (encodedSourceMap) {
        transpiledJavaScriptCode += `\n//# sourceMappingURL=data:application/json;base64,${encodedSourceMap}`;
      }
    }

    return {
      transpiledJavaScriptCode,
      errorMessage: diagnosticError
        ? getDiagnosticErrorMessage(typeScript, diagnosticError)
        : null,
      diagnostics: errorDiagnostics.map((diagnostic: any) =>
        toTypeScriptDiagnostic(typeScript, diagnostic)
      ),
    };
  } catch (error) {
    const errorDetails =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
        ? error
        : 'Unknown transpilation error.';
    console.error('Unable to transpile TypeScript code.', error);
    const detailedErrorMessage = `Unable to transpile TypeScript code: ${errorDetails}`;
    return {
      transpiledJavaScriptCode:
        '// TypeScript transpilation failed. Check editor diagnostics.',
      errorMessage: detailedErrorMessage,
      diagnostics: [
        {
          message: detailedErrorMessage,
          filePath: '',
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1,
        },
      ],
    };
  }
};

const rejectAllPendingWorkerRequests = (message: string): void => {
  pendingTypeScriptWorkerRequests.forEach(({ reject }) => {
    reject(new Error(message));
  });
  pendingTypeScriptWorkerRequests.clear();
};

const getOrCreateTypeScriptCompilerWorker = (): Worker => {
  if (typeScriptCompilerWorker) return typeScriptCompilerWorker;

  typeScriptCompilerWorker = createTypeScriptCompilerWorker();
  typeScriptCompilerWorker.onmessage = (event: MessageEvent) => {
    const data = event.data as TypeScriptWorkerResponse;
    const pendingRequest = pendingTypeScriptWorkerRequests.get(data.requestId);
    if (!pendingRequest) return;

    pendingTypeScriptWorkerRequests.delete(data.requestId);
    if (data.type === 'DONE') {
      pendingRequest.resolve(data.result);
      return;
    }
    pendingRequest.reject(
      new Error(data.message || 'TypeScript worker returned an error.')
    );
  };

  typeScriptCompilerWorker.onerror = () => {
    rejectAllPendingWorkerRequests('TypeScript worker crashed.');
    if (typeScriptCompilerWorker) {
      typeScriptCompilerWorker.terminate();
      typeScriptCompilerWorker = null;
    }
  };

  return typeScriptCompilerWorker;
};

const transpileTypeScriptCodeInWorker = (
  typeScriptSource: string,
  options?: TypeScriptTranspileOptions
): Promise<TypeScriptTranspilationResult> => {
  if (typeof Worker === 'undefined') {
    return Promise.reject(new Error('Web Workers are not available.'));
  }

  return new Promise((resolve, reject) => {
    const worker = getOrCreateTypeScriptCompilerWorker();
    const requestId = nextTypeScriptWorkerRequestId++;
    pendingTypeScriptWorkerRequests.set(requestId, {
      resolve,
      reject,
    });
    worker.postMessage({
      type: 'TRANSPILE',
      requestId,
      typeScriptSource,
      options: options || {},
    });
  });
};

export const preloadTypeScriptCompiler = (): void => {
  if (typeof Worker !== 'undefined') {
    try {
      const worker = getOrCreateTypeScriptCompilerWorker();
      worker.postMessage({ type: 'PRELOAD' });
      return;
    } catch (error) {}
  }

  loadTypeScript().catch(error => {
    console.error('Unable to preload the TypeScript compiler.', error);
  });
};

export const isTypeScriptStoredCode = (inlineCode: string): boolean =>
  inlineCode.startsWith(TYPE_SCRIPT_SOURCE_PREFIX);

export const extractTypeScriptSource = (inlineCode: string): string | null => {
  if (!isTypeScriptStoredCode(inlineCode)) return null;

  const firstNewLineIndex = inlineCode.indexOf('\n');
  const encodedSource =
    firstNewLineIndex === -1
      ? inlineCode.slice(TYPE_SCRIPT_SOURCE_PREFIX.length)
      : inlineCode.slice(TYPE_SCRIPT_SOURCE_PREFIX.length, firstNewLineIndex);

  if (!encodedSource.trim()) return '';
  return decodeBase64(encodedSource.trim());
};

export const extractTranspiledJavaScriptCode = (inlineCode: string): string => {
  if (!isTypeScriptStoredCode(inlineCode)) return inlineCode;

  const firstNewLineIndex = inlineCode.indexOf('\n');
  if (firstNewLineIndex === -1) return '';

  return inlineCode.slice(firstNewLineIndex + 1);
};

export const buildTypeScriptStoredCode = ({
  typeScriptSource,
  transpiledJavaScriptCode,
}: {
  typeScriptSource: string;
  transpiledJavaScriptCode: string;
}): string =>
  `${TYPE_SCRIPT_SOURCE_PREFIX}${encodeBase64(typeScriptSource)}\n${transpiledJavaScriptCode}`;

export const transpileTypeScriptCode = async (
  typeScriptSource: string,
  options?: TypeScriptTranspileOptions
): Promise<TypeScriptTranspilationResult> => {
  try {
    return await transpileTypeScriptCodeInWorker(typeScriptSource, options);
  } catch (workerError) {
    if (!hasLoggedWorkerFallback) {
      hasLoggedWorkerFallback = true;
      console.warn(
        'TypeScript worker unavailable. Falling back to main-thread transpilation.',
        workerError
      );
    }
    return transpileTypeScriptCodeOnMainThread(typeScriptSource, options);
  }
};
