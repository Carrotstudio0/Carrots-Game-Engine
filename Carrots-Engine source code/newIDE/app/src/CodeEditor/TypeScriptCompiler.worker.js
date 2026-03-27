/* eslint-env worker */

let typeScriptModulePromise = null;

const GDEVELOP_COMPILER_AMBIENT_DECLARATIONS = `
declare namespace gdjs {
  class RuntimeScene {}
  class RuntimeObject {
    getBehavior(name: string): RuntimeBehavior;
  }
  class RuntimeBehavior {
    owner: RuntimeObject;
  }
  const evtTools: any;
  namespace ts {
    function setExternalModule(moduleName: string, moduleValue: any): void;
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
declare function liveRepl(code: string): any;
`;

const appendCompilerAmbientDeclarations = source =>
  `${source || ''}\n\n${GDEVELOP_COMPILER_AMBIENT_DECLARATIONS}`;

const encodeBase64 = text => {
  if (typeof btoa !== 'function') return '';
  if (typeof TextEncoder === 'undefined') return btoa(text);

  const encoded = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < encoded.length; i++) {
    binary += String.fromCharCode(encoded[i]);
  }
  return btoa(binary);
};

const loadTypeScript = async () => {
  if (!typeScriptModulePromise) {
    typeScriptModulePromise = import(
      /* webpackChunkName: "typescript-compiler" */ 'typescript'
    ).then(module => (module.default ? module.default : module));
  }
  return typeScriptModulePromise;
};

const getDiagnosticErrorMessage = (typeScript, diagnostic) => {
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

const toTypeScriptDiagnostic = (typeScript, diagnostic) => {
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

const transpileTypeScriptCode = async (typeScriptSource, options) => {
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
      sourceMap: !!(options && options.inlineSourceMap),
      inlineSources: !!(options && options.inlineSourceMap),
    },
    fileName: (options && options.fileName) || 'script.ts',
    reportDiagnostics: true,
  });

  const diagnostics = transpiled.diagnostics || [];
  const errorDiagnostics = diagnostics.filter(
    diagnostic => diagnostic.category === typeScript.DiagnosticCategory.Error
  );
  const diagnosticError = diagnostics.find(
    diagnostic => diagnostic.category === typeScript.DiagnosticCategory.Error
  );

  let transpiledJavaScriptCode = transpiled.outputText || '';
  if (options && options.inlineSourceMap && transpiled.sourceMapText) {
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
    diagnostics: errorDiagnostics.map(diagnostic =>
      toTypeScriptDiagnostic(typeScript, diagnostic)
    ),
  };
};

// eslint-disable-next-line no-restricted-globals
self.onmessage = async event => {
  const { type, requestId, typeScriptSource, options } = event.data || {};
  if (type === 'PRELOAD') {
    try {
      await loadTypeScript();
    } catch (error) {}
    return;
  }
  if (type !== 'TRANSPILE' || typeof requestId !== 'number') return;

  try {
    const result = await transpileTypeScriptCode(typeScriptSource || '', options);
    // eslint-disable-next-line no-restricted-globals
    self.postMessage({
      type: 'DONE',
      requestId,
      result,
    });
  } catch (error) {
    // eslint-disable-next-line no-restricted-globals
    self.postMessage({
      type: 'ERROR',
      requestId,
      message:
        (error && error.message) || 'Unable to transpile TypeScript code.',
    });
  }
};
