// @flow

export type ScriptingMode = 'event-sheet' | 'typescript';

const SCRIPTING_MODE_EXTENSION_NAME = 'GDevelopEditor';
const SCRIPTING_MODE_PROPERTY_NAME = 'scriptingMode';

const sanitizeScriptingMode = (value: string): ScriptingMode =>
  value === 'typescript' ? 'typescript' : 'event-sheet';

export const getProjectScriptingMode = (project: gdProject): ScriptingMode => {
  try {
    const value = project
      .getExtensionProperties()
      .getValue(SCRIPTING_MODE_EXTENSION_NAME, SCRIPTING_MODE_PROPERTY_NAME);
    return sanitizeScriptingMode(value);
  } catch (error) {
    return 'event-sheet';
  }
};

export const setProjectScriptingMode = (
  project: gdProject,
  scriptingMode: ScriptingMode
): void => {
  project
    .getExtensionProperties()
    .setValue(
      SCRIPTING_MODE_EXTENSION_NAME,
      SCRIPTING_MODE_PROPERTY_NAME,
      scriptingMode
    );
};
