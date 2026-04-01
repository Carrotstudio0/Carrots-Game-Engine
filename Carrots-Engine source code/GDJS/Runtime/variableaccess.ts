/*
 * GDevelop JS Platform
 * Copyright 2013-2026 Florian Rival (Florian.Rival@gmail.com). All rights reserved.
 * This project is released under the MIT License.
 */
namespace gdjs {
  /**
   * A single part of a variable path.
   * Examples:
   * - "stats" in `player.stats.hp`
   * - 0 in `inventory[0].name`
   * @category Core Engine > Variables
   */
  export type VariablePathPart = string | integer;

  /**
   * A variable path, either as string or already split parts.
   * @category Core Engine > Variables
   */
  export type VariablePath = string | VariablePathPart[];

  /**
   * Options to control path resolution behavior.
   * @category Core Engine > Variables
   */
  export interface VariableAccessOptions {
    createIfMissing?: boolean;
  }

  const variablePathPartRegExp = /([^[.\]]+)|\[(\d+)\]/g;

  const toPathParts = (path: VariablePath): VariablePathPart[] => {
    if (Array.isArray(path)) {
      return path;
    }
    const trimmedPath = (path || '').trim();
    if (trimmedPath.length === 0) {
      return [];
    }

    const parts: VariablePathPart[] = [];
    let match: RegExpExecArray | null = null;
    variablePathPartRegExp.lastIndex = 0;
    while ((match = variablePathPartRegExp.exec(trimmedPath)) !== null) {
      if (match[2] !== undefined) {
        parts.push(parseInt(match[2], 10));
      } else if (match[1] !== undefined) {
        parts.push(match[1]);
      }
    }
    variablePathPartRegExp.lastIndex = 0;
    return parts;
  };

  const getChildVariable = (
    parentVariable: gdjs.Variable,
    pathPart: VariablePathPart,
    createIfMissing: boolean
  ): gdjs.Variable | null => {
    if (createIfMissing) {
      return parentVariable.getChild(pathPart);
    }

    if (parentVariable.getType() === 'structure') {
      const childName = '' + pathPart;
      if (!parentVariable.hasChild(childName)) {
        return null;
      }
      return parentVariable.getChildNamed(childName);
    }

    if (parentVariable.getType() === 'array') {
      const childIndex =
        typeof pathPart === 'number' ? pathPart : parseInt(pathPart, 10);
      if (
        !Number.isInteger(childIndex) ||
        childIndex < 0 ||
        childIndex >= parentVariable.getChildrenCount()
      ) {
        return null;
      }
      return parentVariable.getChildAt(childIndex);
    }

    return null;
  };

  const resolveVariableFromContainer = (
    container: gdjs.VariablesContainer,
    path: VariablePath,
    options: VariableAccessOptions = {}
  ): gdjs.Variable | null => {
    const pathParts = toPathParts(path);
    if (pathParts.length === 0) {
      return null;
    }
    const createIfMissing =
      options.createIfMissing === undefined ? true : !!options.createIfMissing;

    const rootName = '' + pathParts[0];
    if (!createIfMissing && !container.has(rootName)) {
      return null;
    }
    let currentVariable = container.get(rootName);
    for (let i = 1; i < pathParts.length; i++) {
      const nextVariable = getChildVariable(
        currentVariable,
        pathParts[i],
        createIfMissing
      );
      if (!nextVariable) {
        return null;
      }
      currentVariable = nextVariable;
    }
    return currentVariable;
  };

  const resolveVariableFromVariable = (
    variable: gdjs.Variable,
    path: VariablePath,
    options: VariableAccessOptions = {}
  ): gdjs.Variable | null => {
    const pathParts = toPathParts(path);
    if (pathParts.length === 0) {
      return variable;
    }
    const createIfMissing =
      options.createIfMissing === undefined ? true : !!options.createIfMissing;

    let currentVariable = variable;
    for (let i = 0; i < pathParts.length; i++) {
      const nextVariable = getChildVariable(
        currentVariable,
        pathParts[i],
        createIfMissing
      );
      if (!nextVariable) {
        return null;
      }
      currentVariable = nextVariable;
    }
    return currentVariable;
  };

  const removeChildFromVariable = (
    variable: gdjs.Variable,
    childPathPart: VariablePathPart
  ): boolean => {
    if (variable.getType() === 'structure') {
      variable.removeChild('' + childPathPart);
      return true;
    }
    if (variable.getType() === 'array') {
      const childIndex =
        typeof childPathPart === 'number'
          ? childPathPart
          : parseInt(childPathPart, 10);
      if (!Number.isInteger(childIndex) || childIndex < 0) {
        return false;
      }
      if (childIndex >= variable.getChildrenCount()) {
        return false;
      }
      variable.removeAtIndex(childIndex);
      return true;
    }
    return false;
  };

  const removeVariableFromContainer = (
    container: gdjs.VariablesContainer,
    path: VariablePath
  ): boolean => {
    const pathParts = toPathParts(path);
    if (pathParts.length === 0) {
      return false;
    }
    if (pathParts.length === 1) {
      const variableName = '' + pathParts[0];
      if (!container.has(variableName)) {
        return false;
      }
      container.remove(variableName);
      return true;
    }

    const parentVariable = resolveVariableFromContainer(
      container,
      pathParts.slice(0, pathParts.length - 1),
      { createIfMissing: false }
    );
    if (!parentVariable) {
      return false;
    }
    return removeChildFromVariable(parentVariable, pathParts[pathParts.length - 1]);
  };

  const getGlobalVariablesContainer = (
    runtimeContext: gdjs.RuntimeGame | gdjs.RuntimeInstanceContainer
  ): gdjs.VariablesContainer => {
    const runtimeContextAsAny = runtimeContext as any;
    if (
      runtimeContextAsAny &&
      typeof runtimeContextAsAny.getGame === 'function'
    ) {
      return (runtimeContext as gdjs.RuntimeInstanceContainer)
        .getGame()
        .getVariables();
    }
    return (runtimeContext as gdjs.RuntimeGame).getVariables();
  };

  /**
   * High-level TypeScript variable helpers with support for:
   * - global variables
   * - scene variables
   * - object variables
   * - nested paths (`stats.hp`, `inventory[0].id`)
   *
   * @category Core Engine > Variables
   */
  export namespace variables {
    export const variable = (
      container: gdjs.VariablesContainer,
      path: VariablePath,
      options: VariableAccessOptions = {}
    ): gdjs.Variable | null =>
      resolveVariableFromContainer(container, path, options);

    export const has = (
      container: gdjs.VariablesContainer,
      path: VariablePath
    ): boolean =>
      !!resolveVariableFromContainer(container, path, { createIfMissing: false });

    export const get = (
      container: gdjs.VariablesContainer,
      path: VariablePath,
      defaultValue: any = undefined
    ): any => {
      const resolvedVariable = resolveVariableFromContainer(container, path, {
        createIfMissing: false,
      });
      return resolvedVariable ? resolvedVariable.toJSObject() : defaultValue;
    };

    export const getNumber = (
      container: gdjs.VariablesContainer,
      path: VariablePath,
      defaultValue: float = 0
    ): float => {
      const resolvedVariable = resolveVariableFromContainer(container, path, {
        createIfMissing: false,
      });
      return resolvedVariable ? resolvedVariable.getAsNumber() : defaultValue;
    };

    export const getString = (
      container: gdjs.VariablesContainer,
      path: VariablePath,
      defaultValue: string = ''
    ): string => {
      const resolvedVariable = resolveVariableFromContainer(container, path, {
        createIfMissing: false,
      });
      return resolvedVariable ? resolvedVariable.getAsString() : defaultValue;
    };

    export const getBoolean = (
      container: gdjs.VariablesContainer,
      path: VariablePath,
      defaultValue: boolean = false
    ): boolean => {
      const resolvedVariable = resolveVariableFromContainer(container, path, {
        createIfMissing: false,
      });
      return resolvedVariable ? resolvedVariable.getAsBoolean() : defaultValue;
    };

    export const set = (
      container: gdjs.VariablesContainer,
      path: VariablePath,
      value: any
    ): boolean => {
      const resolvedVariable = resolveVariableFromContainer(container, path, {
        createIfMissing: true,
      });
      if (!resolvedVariable) {
        return false;
      }
      resolvedVariable.fromJSObject(value);
      return true;
    };

    export const add = (
      container: gdjs.VariablesContainer,
      path: VariablePath,
      value: float
    ): boolean => {
      const resolvedVariable = resolveVariableFromContainer(container, path, {
        createIfMissing: true,
      });
      if (!resolvedVariable) {
        return false;
      }
      resolvedVariable.add(Number.isFinite(value) ? value : 0);
      return true;
    };

    export const sub = (
      container: gdjs.VariablesContainer,
      path: VariablePath,
      value: float
    ): boolean => {
      const resolvedVariable = resolveVariableFromContainer(container, path, {
        createIfMissing: true,
      });
      if (!resolvedVariable) {
        return false;
      }
      resolvedVariable.sub(Number.isFinite(value) ? value : 0);
      return true;
    };

    export const toggleBoolean = (
      container: gdjs.VariablesContainer,
      path: VariablePath
    ): boolean => {
      const resolvedVariable = resolveVariableFromContainer(container, path, {
        createIfMissing: true,
      });
      if (!resolvedVariable) {
        return false;
      }
      resolvedVariable.toggle();
      return true;
    };

    export const remove = (
      container: gdjs.VariablesContainer,
      path: VariablePath
    ): boolean => removeVariableFromContainer(container, path);

    export const variableFromVariable = (
      variable: gdjs.Variable,
      path: VariablePath,
      options: VariableAccessOptions = {}
    ): gdjs.Variable | null => resolveVariableFromVariable(variable, path, options);

    export const removeFromVariable = (
      variable: gdjs.Variable,
      path: VariablePath
    ): boolean => {
      const pathParts = toPathParts(path);
      if (pathParts.length === 0) {
        return false;
      }
      if (pathParts.length === 1) {
        return removeChildFromVariable(variable, pathParts[0]);
      }
      const parentVariable = resolveVariableFromVariable(
        variable,
        pathParts.slice(0, pathParts.length - 1),
        { createIfMissing: false }
      );
      if (!parentVariable) {
        return false;
      }
      return removeChildFromVariable(parentVariable, pathParts[pathParts.length - 1]);
    };

    export namespace scene {
      export const variable = (
        runtimeScene: gdjs.RuntimeScene,
        path: VariablePath,
        options: VariableAccessOptions = {}
      ): gdjs.Variable | null =>
        resolveVariableFromContainer(runtimeScene.getVariables(), path, options);

      export const has = (
        runtimeScene: gdjs.RuntimeScene,
        path: VariablePath
      ): boolean => variables.has(runtimeScene.getVariables(), path);

      export const get = (
        runtimeScene: gdjs.RuntimeScene,
        path: VariablePath,
        defaultValue: any = undefined
      ): any => variables.get(runtimeScene.getVariables(), path, defaultValue);

      export const getNumber = (
        runtimeScene: gdjs.RuntimeScene,
        path: VariablePath,
        defaultValue: float = 0
      ): float => variables.getNumber(runtimeScene.getVariables(), path, defaultValue);

      export const getString = (
        runtimeScene: gdjs.RuntimeScene,
        path: VariablePath,
        defaultValue: string = ''
      ): string => variables.getString(runtimeScene.getVariables(), path, defaultValue);

      export const getBoolean = (
        runtimeScene: gdjs.RuntimeScene,
        path: VariablePath,
        defaultValue: boolean = false
      ): boolean =>
        variables.getBoolean(runtimeScene.getVariables(), path, defaultValue);

      export const set = (
        runtimeScene: gdjs.RuntimeScene,
        path: VariablePath,
        value: any
      ): boolean => variables.set(runtimeScene.getVariables(), path, value);

      export const add = (
        runtimeScene: gdjs.RuntimeScene,
        path: VariablePath,
        value: float
      ): boolean => variables.add(runtimeScene.getVariables(), path, value);

      export const sub = (
        runtimeScene: gdjs.RuntimeScene,
        path: VariablePath,
        value: float
      ): boolean => variables.sub(runtimeScene.getVariables(), path, value);

      export const toggleBoolean = (
        runtimeScene: gdjs.RuntimeScene,
        path: VariablePath
      ): boolean => variables.toggleBoolean(runtimeScene.getVariables(), path);

      export const remove = (
        runtimeScene: gdjs.RuntimeScene,
        path: VariablePath
      ): boolean => variables.remove(runtimeScene.getVariables(), path);
    }

    export namespace global {
      export const variable = (
        runtimeContext: gdjs.RuntimeGame | gdjs.RuntimeInstanceContainer,
        path: VariablePath,
        options: VariableAccessOptions = {}
      ): gdjs.Variable | null =>
        resolveVariableFromContainer(
          getGlobalVariablesContainer(runtimeContext),
          path,
          options
        );

      export const has = (
        runtimeContext: gdjs.RuntimeGame | gdjs.RuntimeInstanceContainer,
        path: VariablePath
      ): boolean => variables.has(getGlobalVariablesContainer(runtimeContext), path);

      export const get = (
        runtimeContext: gdjs.RuntimeGame | gdjs.RuntimeInstanceContainer,
        path: VariablePath,
        defaultValue: any = undefined
      ): any =>
        variables.get(
          getGlobalVariablesContainer(runtimeContext),
          path,
          defaultValue
        );

      export const getNumber = (
        runtimeContext: gdjs.RuntimeGame | gdjs.RuntimeInstanceContainer,
        path: VariablePath,
        defaultValue: float = 0
      ): float =>
        variables.getNumber(
          getGlobalVariablesContainer(runtimeContext),
          path,
          defaultValue
        );

      export const getString = (
        runtimeContext: gdjs.RuntimeGame | gdjs.RuntimeInstanceContainer,
        path: VariablePath,
        defaultValue: string = ''
      ): string =>
        variables.getString(
          getGlobalVariablesContainer(runtimeContext),
          path,
          defaultValue
        );

      export const getBoolean = (
        runtimeContext: gdjs.RuntimeGame | gdjs.RuntimeInstanceContainer,
        path: VariablePath,
        defaultValue: boolean = false
      ): boolean =>
        variables.getBoolean(
          getGlobalVariablesContainer(runtimeContext),
          path,
          defaultValue
        );

      export const set = (
        runtimeContext: gdjs.RuntimeGame | gdjs.RuntimeInstanceContainer,
        path: VariablePath,
        value: any
      ): boolean =>
        variables.set(getGlobalVariablesContainer(runtimeContext), path, value);

      export const add = (
        runtimeContext: gdjs.RuntimeGame | gdjs.RuntimeInstanceContainer,
        path: VariablePath,
        value: float
      ): boolean =>
        variables.add(getGlobalVariablesContainer(runtimeContext), path, value);

      export const sub = (
        runtimeContext: gdjs.RuntimeGame | gdjs.RuntimeInstanceContainer,
        path: VariablePath,
        value: float
      ): boolean =>
        variables.sub(getGlobalVariablesContainer(runtimeContext), path, value);

      export const toggleBoolean = (
        runtimeContext: gdjs.RuntimeGame | gdjs.RuntimeInstanceContainer,
        path: VariablePath
      ): boolean =>
        variables.toggleBoolean(getGlobalVariablesContainer(runtimeContext), path);

      export const remove = (
        runtimeContext: gdjs.RuntimeGame | gdjs.RuntimeInstanceContainer,
        path: VariablePath
      ): boolean => variables.remove(getGlobalVariablesContainer(runtimeContext), path);
    }

    export namespace object {
      export const variable = (
        runtimeObject: gdjs.RuntimeObject,
        path: VariablePath,
        options: VariableAccessOptions = {}
      ): gdjs.Variable | null =>
        resolveVariableFromContainer(runtimeObject.getVariables(), path, options);

      export const has = (
        runtimeObject: gdjs.RuntimeObject,
        path: VariablePath
      ): boolean => variables.has(runtimeObject.getVariables(), path);

      export const get = (
        runtimeObject: gdjs.RuntimeObject,
        path: VariablePath,
        defaultValue: any = undefined
      ): any => variables.get(runtimeObject.getVariables(), path, defaultValue);

      export const getNumber = (
        runtimeObject: gdjs.RuntimeObject,
        path: VariablePath,
        defaultValue: float = 0
      ): float => variables.getNumber(runtimeObject.getVariables(), path, defaultValue);

      export const getString = (
        runtimeObject: gdjs.RuntimeObject,
        path: VariablePath,
        defaultValue: string = ''
      ): string => variables.getString(runtimeObject.getVariables(), path, defaultValue);

      export const getBoolean = (
        runtimeObject: gdjs.RuntimeObject,
        path: VariablePath,
        defaultValue: boolean = false
      ): boolean =>
        variables.getBoolean(runtimeObject.getVariables(), path, defaultValue);

      export const set = (
        runtimeObject: gdjs.RuntimeObject,
        path: VariablePath,
        value: any
      ): boolean => variables.set(runtimeObject.getVariables(), path, value);

      export const add = (
        runtimeObject: gdjs.RuntimeObject,
        path: VariablePath,
        value: float
      ): boolean => variables.add(runtimeObject.getVariables(), path, value);

      export const sub = (
        runtimeObject: gdjs.RuntimeObject,
        path: VariablePath,
        value: float
      ): boolean => variables.sub(runtimeObject.getVariables(), path, value);

      export const toggleBoolean = (
        runtimeObject: gdjs.RuntimeObject,
        path: VariablePath
      ): boolean => variables.toggleBoolean(runtimeObject.getVariables(), path);

      export const remove = (
        runtimeObject: gdjs.RuntimeObject,
        path: VariablePath
      ): boolean => variables.remove(runtimeObject.getVariables(), path);
    }
  }
}
