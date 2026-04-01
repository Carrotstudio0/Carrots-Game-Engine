// @flow
import {
  loadProjectTypeScriptScripts,
  TYPE_SCRIPT_PROJECT_SCRIPTS_EXTENSION_NAME,
  TYPE_SCRIPT_PROJECT_SCRIPTS_PROPERTY_NAME,
} from './ProjectTypeScriptScriptsMetadata';

const gd: libGDevelop = global.gd;

export const TYPE_SCRIPT_BEHAVIORS_EXTENSION_NAME = 'TypeScriptBehaviors';
export const TYPE_SCRIPT_BEHAVIOR_TYPE_PREFIX = 'TypeScriptBehaviors::';

const behaviorRegistrationPatterns = [
  /registerProjectBehavior\s*\(\s*(['"`])([^'"`]+)\1/g,
  /gdjs\.ts\.registerProjectBehavior\s*\(\s*(['"`])([^'"`]+)\1/g,
  /gdjs\.registerBehavior\s*\(\s*(['"`])([^'"`]+)\1/g,
];

let lastRegisteredProjectScriptsFingerprint: ?string = null;

const computeBehaviorNameFromType = (behaviorType: string): string => {
  const separators = behaviorType.split('::');
  const rawBehaviorName = separators[separators.length - 1] || behaviorType;
  return rawBehaviorName || 'TypeScriptBehavior';
};

const addBehaviorTypesFromSource = (
  source: string,
  outputSet: Set<string>
) => {
  if (!source) return;

  behaviorRegistrationPatterns.forEach(pattern => {
    pattern.lastIndex = 0;
    let match = pattern.exec(source);
    while (match) {
      const behaviorType = match[2];
      if (
        behaviorType &&
        behaviorType.startsWith(TYPE_SCRIPT_BEHAVIOR_TYPE_PREFIX)
      ) {
        outputSet.add(behaviorType);
      }
      match = pattern.exec(source);
    }
  });
};

export const extractTypeScriptProjectBehaviorTypes = (
  project: gdProject
): Array<string> => {
  const scripts = loadProjectTypeScriptScripts(project);
  const behaviorTypes = new Set<string>();
  scripts.forEach(script => {
    addBehaviorTypesFromSource(script.source, behaviorTypes);
  });
  return Array.from(behaviorTypes).sort();
};

const createBehaviorImplementation = (): gdBehaviorJsImplementation => {
  const behavior = new gd.BehaviorJsImplementation();
  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[cannot-write]
  behavior.updateProperty = function(behaviorContent, propertyName, newValue) {
    return false;
  };
  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[cannot-write]
  behavior.getProperties = function(behaviorContent) {
    return new gd.MapStringPropertyDescriptor();
  };
  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[cannot-write]
  behavior.initializeContent = function(behaviorContent) {};
  return behavior;
};

export const refreshTypeScriptProjectBehaviorsExtension = (
  project: gdProject
): void => {
  if (!project) return;

  const behaviorTypes = extractTypeScriptProjectBehaviorTypes(project);
  const scriptsFingerprint = `${project.ptr || 'project'}:${behaviorTypes.join(
    '|'
  )}`;
  if (scriptsFingerprint === lastRegisteredProjectScriptsFingerprint) return;

  const platform = gd.JsPlatform.get();
  platform.removeExtension(TYPE_SCRIPT_BEHAVIORS_EXTENSION_NAME);

  if (!behaviorTypes.length) {
    lastRegisteredProjectScriptsFingerprint = scriptsFingerprint;
    return;
  }

  const extension = new gd.PlatformExtension();
  extension.setExtensionInformation(
    TYPE_SCRIPT_BEHAVIORS_EXTENSION_NAME,
    'TypeScript Project Behaviors',
    'Behaviors registered from project TypeScript scripts.',
    'Carrots Engine',
    'MIT'
  );
  extension.setCategory('Scripting');
  extension.setTags('typescript,scripting,project');

  behaviorTypes.forEach(behaviorType => {
    const behaviorName = computeBehaviorNameFromType(behaviorType);
    const behaviorImplementation = createBehaviorImplementation();
    extension.addBehavior(
      behaviorName,
      behaviorName,
      behaviorName,
      'TypeScript behavior registered from project scripts.',
      '',
      'res/function24.png',
      behaviorName,
      behaviorImplementation,
      new gd.BehaviorsSharedData()
    );
  });

  platform.addNewExtension(extension);
  extension.delete();
  lastRegisteredProjectScriptsFingerprint = scriptsFingerprint;
};

export const clearTypeScriptProjectBehaviorsExtension = (): void => {
  gd.JsPlatform.get().removeExtension(TYPE_SCRIPT_BEHAVIORS_EXTENSION_NAME);
  lastRegisteredProjectScriptsFingerprint = null;
};

export const hasProjectTypeScriptScripts = (project: gdProject): boolean => {
  const serializedScripts = project
    .getExtensionProperties()
    .getValue(
      TYPE_SCRIPT_PROJECT_SCRIPTS_EXTENSION_NAME,
      TYPE_SCRIPT_PROJECT_SCRIPTS_PROPERTY_NAME
    );
  return !!serializedScripts;
};
