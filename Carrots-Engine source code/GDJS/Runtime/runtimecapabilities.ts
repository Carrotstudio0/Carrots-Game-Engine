/*
 * GDevelop JS Platform
 * Copyright 2013-2026 Florian Rival (Florian.Rival@gmail.com). All rights reserved.
 * This project is released under the MIT License.
 */
namespace gdjs {
  export namespace runtimeCapabilities {
    export type RuntimeCallable = (...args: any[]) => unknown;

    export interface BehaviorEntry {
      name: string;
      type: string;
      activated: boolean;
      behavior: gdjs.RuntimeBehavior;
    }

    export interface BehaviorCapability {
      behaviorType: string;
      methods: {
        [methodName: string]: (
          behavior: gdjs.RuntimeBehavior,
          ...args: any[]
        ) => unknown;
      };
    }

    export interface ExtensionCapability {
      extensionName: string;
      methods: {
        [methodName: string]: RuntimeCallable;
      };
    }

    export interface ManualObjectExtensionContext {
      object: gdjs.RuntimeObject;
      extensionName: string;
      config: { [key: string]: unknown };
      state: { [key: string]: unknown };
    }

    export type ManualObjectExtensionMethod = (
      context: ManualObjectExtensionContext,
      ...args: any[]
    ) => unknown;

    export interface ManualObjectExtensionBinding {
      extensionName: string;
      methods: { [methodName: string]: ManualObjectExtensionMethod };
      config?: { [key: string]: unknown };
      state?: { [key: string]: unknown };
    }

    export interface RuntimeCapabilitiesSummary {
      behaviorTypes: string[];
      extensions: string[];
      registeredBehaviorCapabilityTypes: string[];
      registeredExtensionCapabilityNames: string[];
    }

    export interface InputButtonSnapshot {
      index: number;
      pressed: boolean;
      touched: boolean;
      value: number;
    }

    export interface InputGamepadSnapshot {
      index: number;
      id: string;
      connected: boolean;
      mapping: string;
      timestamp: number;
      axes: number[];
      buttons: InputButtonSnapshot[];
    }

    export interface InputTouchSnapshot {
      id: number;
      x: number;
      y: number;
      justEnded: boolean;
      isMouseTouch: boolean;
    }

    export interface InputSnapshot {
      keyboard: {
        lastPressedKey: number;
        pressedKeys: number[];
        justPressedKeys: number[];
        releasedKeys: number[];
      };
      mouse: {
        x: number;
        y: number;
        cursorX: number;
        cursorY: number;
        movementX: number;
        movementY: number;
        insideCanvas: boolean;
        wheelDeltaX: number;
        wheelDeltaY: number;
        wheelDeltaZ: number;
        pressedButtons: number[];
        releasedButtons: number[];
      };
      touch: {
        simulateMouse: boolean;
        startedTouches: number[];
        touches: InputTouchSnapshot[];
      };
      gamepads: InputGamepadSnapshot[];
    }

    export interface RuntimeEngineAccess {
      gdjs: typeof gdjs;
      runtimeGame: gdjs.RuntimeGame | null;
      renderer: unknown;
      inputManager: gdjs.InputManager | null;
      sceneStack: unknown;
      currentScene: gdjs.RuntimeScene | null;
    }

    const _behaviorCapabilities = new Hashtable<
      Hashtable<(behavior: gdjs.RuntimeBehavior, ...args: any[]) => unknown>
    >();
    const _extensionCapabilities = new Hashtable<Hashtable<RuntimeCallable>>();
    const _manualBindingsByObjectId = new Hashtable<
      Hashtable<ManualObjectExtensionBinding>
    >();

    const _cloneRecord = (
      source?: { [key: string]: unknown }
    ): { [key: string]: unknown } => {
      if (!source) {
        return {};
      }
      return { ...source };
    };

    const _getOrCreateMethodTable = <T>(
      registry: Hashtable<Hashtable<T>>,
      key: string
    ): Hashtable<T> => {
      let methodTable = registry.get(key);
      if (!methodTable) {
        methodTable = new Hashtable<T>();
        registry.put(key, methodTable);
      }
      return methodTable;
    };

    const _normalizeExtensionName = (extensionName: string): string =>
      extensionName.replace(/[^a-zA-Z0-9_]/g, '');

    const _getCallableMethodNames = (target: unknown): string[] => {
      if (!target) {
        return [];
      }
      const methodNamesByKey: { [key: string]: true } = {};
      let prototype = Object.getPrototypeOf(target);
      while (prototype && prototype !== Object.prototype) {
        const ownProperties = Object.getOwnPropertyNames(prototype);
        for (const propertyName of ownProperties) {
          if (propertyName === 'constructor') {
            continue;
          }
          const value = (target as any)[propertyName];
          if (typeof value === 'function') {
            methodNamesByKey[propertyName] = true;
          }
        }
        prototype = Object.getPrototypeOf(prototype);
      }
      const methodNames = Object.keys(methodNamesByKey);
      methodNames.sort();
      return methodNames;
    };

    const _resolveBehavior = (
      object: gdjs.RuntimeObject,
      behaviorNameOrType: string
    ): BehaviorEntry | null => {
      const behaviorByName = object.getBehavior(behaviorNameOrType);
      if (behaviorByName) {
        return {
          name: behaviorByName.getName(),
          type: behaviorByName.type,
          activated: behaviorByName.activated(),
          behavior: behaviorByName,
        };
      }
      const behaviorByType = object.getBehaviorByType(behaviorNameOrType);
      if (behaviorByType) {
        return {
          name: behaviorByType.getName(),
          type: behaviorByType.type,
          activated: behaviorByType.activated(),
          behavior: behaviorByType,
        };
      }
      return null;
    };

    const _resolveExtensionNamespace = (extensionName: string): unknown => {
      const gdjsAny = gdjs as any;
      if (gdjsAny[extensionName] !== undefined) {
        return gdjsAny[extensionName];
      }

      const normalizedExtensionName = _normalizeExtensionName(extensionName);
      if (
        normalizedExtensionName &&
        gdjsAny[normalizedExtensionName] !== undefined
      ) {
        return gdjsAny[normalizedExtensionName];
      }

      if (!gdjsAny.evtTools) {
        return null;
      }
      if (gdjsAny.evtTools[extensionName] !== undefined) {
        return gdjsAny.evtTools[extensionName];
      }
      if (
        normalizedExtensionName &&
        gdjsAny.evtTools[normalizedExtensionName] !== undefined
      ) {
        return gdjsAny.evtTools[normalizedExtensionName];
      }
      return null;
    };

    const _invokeExtensionNamespaceMethod = (
      extensionName: string,
      methodName: string,
      ...args: any[]
    ): unknown => {
      const namespace = _resolveExtensionNamespace(extensionName) as
        | { [methodName: string]: RuntimeCallable }
        | null;
      if (!namespace || typeof namespace[methodName] !== 'function') {
        return undefined;
      }
      return namespace[methodName](...args);
    };

    const _resolveRuntimeGame = (
      source?:
        | gdjs.RuntimeGame
        | gdjs.RuntimeInstanceContainer
        | gdjs.RuntimeScene
        | null
    ): gdjs.RuntimeGame | null => {
      if (!source) {
        return null;
      }
      const sourceAny = source as any;
      if (
        typeof sourceAny.getInputManager === 'function' &&
        typeof sourceAny.getRenderer === 'function'
      ) {
        return sourceAny as gdjs.RuntimeGame;
      }
      if (typeof sourceAny.getGame === 'function') {
        const runtimeGame = sourceAny.getGame();
        if (
          runtimeGame &&
          typeof runtimeGame.getInputManager === 'function' &&
          typeof runtimeGame.getRenderer === 'function'
        ) {
          return runtimeGame as gdjs.RuntimeGame;
        }
      }
      return null;
    };

    const _getCurrentSceneFromRuntimeGame = (
      runtimeGame: gdjs.RuntimeGame | null
    ): gdjs.RuntimeScene | null => {
      if (!runtimeGame) {
        return null;
      }
      try {
        const sceneStack = runtimeGame.getSceneStack();
        if (!sceneStack || typeof sceneStack.getCurrentScene !== 'function') {
          return null;
        }
        return sceneStack.getCurrentScene();
      } catch (error) {
        return null;
      }
    };

    const _listTruthyNumericKeys = (
      valuesByKey: { [key: string]: unknown } | null | undefined
    ): number[] => {
      const keys: number[] = [];
      if (!valuesByKey) {
        return keys;
      }
      for (const key in valuesByKey) {
        if (!Object.prototype.hasOwnProperty.call(valuesByKey, key)) {
          continue;
        }
        if (!valuesByKey[key]) {
          continue;
        }
        const parsedKey = parseInt(key, 10);
        if (!Number.isNaN(parsedKey)) {
          keys.push(parsedKey);
        }
      }
      keys.sort((a, b) => a - b);
      return keys;
    };

    const _getGamepadsSnapshot = (): InputGamepadSnapshot[] => {
      const globalNavigator: any =
        typeof navigator !== 'undefined' ? navigator : null;
      if (!globalNavigator) {
        return [];
      }

      let rawGamepads: any = null;
      try {
        if (typeof globalNavigator.getGamepads === 'function') {
          rawGamepads = globalNavigator.getGamepads();
        } else if (typeof globalNavigator.webkitGetGamepads === 'function') {
          rawGamepads = globalNavigator.webkitGetGamepads();
        } else if (globalNavigator.webkitGamepads) {
          rawGamepads = globalNavigator.webkitGamepads;
        } else if (globalNavigator.mozGamepads) {
          rawGamepads = globalNavigator.mozGamepads;
        }
      } catch (error) {
        rawGamepads = null;
      }
      if (!rawGamepads) {
        return [];
      }

      const gamepads: InputGamepadSnapshot[] = [];
      for (let index = 0; index < rawGamepads.length; index++) {
        const gamepad = rawGamepads[index];
        if (!gamepad) {
          continue;
        }
        const buttons: InputButtonSnapshot[] = [];
        const rawButtons = gamepad.buttons || [];
        for (let buttonIndex = 0; buttonIndex < rawButtons.length; buttonIndex++) {
          const button = rawButtons[buttonIndex];
          buttons.push({
            index: buttonIndex,
            pressed: !!(button && button.pressed),
            touched: !!(button && button.touched),
            value:
              button && typeof button.value === 'number' ? button.value : 0,
          });
        }
        gamepads.push({
          index: typeof gamepad.index === 'number' ? gamepad.index : index,
          id: typeof gamepad.id === 'string' ? gamepad.id : '',
          connected:
            typeof gamepad.connected === 'boolean' ? gamepad.connected : true,
          mapping: typeof gamepad.mapping === 'string' ? gamepad.mapping : '',
          timestamp:
            typeof gamepad.timestamp === 'number' ? gamepad.timestamp : 0,
          axes: Array.isArray(gamepad.axes)
            ? gamepad.axes.map((axisValue: unknown) =>
                typeof axisValue === 'number' ? axisValue : 0
              )
            : [],
          buttons,
        });
      }
      return gamepads;
    };

    const _resolvePath = (
      root: { [key: string]: unknown },
      path: string
    ): { owner: unknown; value: unknown } => {
      if (!path || typeof path !== 'string') {
        return { owner: null, value: root };
      }
      const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
      const parts = normalizedPath.split('.').filter((part) => !!part);
      let currentValue: unknown = root;
      let owner: unknown = null;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (currentValue === null || typeof currentValue === 'undefined') {
          return { owner: null, value: undefined };
        }
        owner = currentValue;
        currentValue = (currentValue as any)[part];
      }
      return { owner, value: currentValue };
    };

    const _getObjectId = (object: gdjs.RuntimeObject): string =>
      `${object.getUniqueId()}`;

    const _getOrCreateManualBindingsForObject = (
      object: gdjs.RuntimeObject
    ): Hashtable<ManualObjectExtensionBinding> => {
      const objectId = _getObjectId(object);
      let objectBindings = _manualBindingsByObjectId.get(objectId);
      if (!objectBindings) {
        objectBindings = new Hashtable<ManualObjectExtensionBinding>();
        _manualBindingsByObjectId.put(objectId, objectBindings);
      }
      return objectBindings;
    };

    export const getRuntimeCapabilitiesSummary =
      function (): RuntimeCapabilitiesSummary {
        return {
          behaviorTypes: gdjs.getRegisteredBehaviorTypes(),
          extensions: gdjs.getRegisteredExtensionNames(),
          registeredBehaviorCapabilityTypes:
            gdjs.runtimeCapabilities.listRegisteredBehaviorCapabilityTypes(),
          registeredExtensionCapabilityNames:
            gdjs.runtimeCapabilities.listRegisteredExtensionCapabilityNames(),
        };
      };

    export const listObjectBehaviors = function (
      object: gdjs.RuntimeObject
    ): BehaviorEntry[] {
      const behaviorEntries: BehaviorEntry[] = [];
      const behaviors = object.getAllBehaviors();
      for (const behavior of behaviors) {
        behaviorEntries.push({
          name: behavior.getName(),
          type: behavior.type,
          activated: behavior.activated(),
          behavior,
        });
      }
      return behaviorEntries;
    };

    export const resolveBehavior = function (
      object: gdjs.RuntimeObject,
      behaviorNameOrType: string
    ): BehaviorEntry | null {
      return _resolveBehavior(object, behaviorNameOrType);
    };

    export const listBehaviorMethods = function (
      object: gdjs.RuntimeObject,
      behaviorNameOrType: string
    ): string[] {
      const behaviorEntry = _resolveBehavior(object, behaviorNameOrType);
      if (!behaviorEntry) {
        return [];
      }
      const methodNamesByKey: { [key: string]: true } = {};
      const directMethods = _getCallableMethodNames(behaviorEntry.behavior);
      for (const methodName of directMethods) {
        methodNamesByKey[methodName] = true;
      }
      const registeredMethods = _behaviorCapabilities.get(behaviorEntry.type);
      if (registeredMethods) {
        for (const methodName in registeredMethods.items) {
          if (
            Object.prototype.hasOwnProperty.call(registeredMethods.items, methodName)
          ) {
            methodNamesByKey[methodName] = true;
          }
        }
      }
      const methodNames = Object.keys(methodNamesByKey);
      methodNames.sort();
      return methodNames;
    };

    export const invokeBehaviorMethod = function (
      object: gdjs.RuntimeObject,
      behaviorNameOrType: string,
      methodName: string,
      ...args: any[]
    ): unknown {
      const behaviorEntry = _resolveBehavior(object, behaviorNameOrType);
      if (!behaviorEntry) {
        return undefined;
      }

      const behaviorTypeMethods = _behaviorCapabilities.get(behaviorEntry.type);
      if (behaviorTypeMethods && behaviorTypeMethods.containsKey(methodName)) {
        const method = behaviorTypeMethods.get(methodName);
        if (typeof method === 'function') {
          return method(behaviorEntry.behavior, ...args);
        }
      }

      const behaviorAsAny = behaviorEntry.behavior as any;
      const directMethod = behaviorAsAny[methodName];
      if (typeof directMethod !== 'function') {
        return undefined;
      }
      return directMethod.apply(behaviorEntry.behavior, args);
    };

    export const registerBehaviorCapability = function (
      capability: BehaviorCapability
    ): void {
      if (!capability || !capability.behaviorType) {
        return;
      }
      const methodTable = _getOrCreateMethodTable(
        _behaviorCapabilities,
        capability.behaviorType
      );
      for (const methodName in capability.methods) {
        if (!Object.prototype.hasOwnProperty.call(capability.methods, methodName)) {
          continue;
        }
        const method = capability.methods[methodName];
        if (typeof method === 'function') {
          methodTable.put(methodName, method);
        }
      }
    };

    export const unregisterBehaviorCapability = function (
      behaviorType: string,
      methodName?: string
    ): void {
      if (!_behaviorCapabilities.containsKey(behaviorType)) {
        return;
      }
      if (!methodName) {
        _behaviorCapabilities.remove(behaviorType);
        return;
      }
      _behaviorCapabilities.get(behaviorType).remove(methodName);
    };

    export const listRegisteredBehaviorCapabilityTypes = function (): string[] {
      const behaviorTypes: string[] = [];
      _behaviorCapabilities.keys(behaviorTypes);
      behaviorTypes.sort();
      return behaviorTypes;
    };

    export const registerExtensionCapability = function (
      capability: ExtensionCapability
    ): void {
      if (!capability || !capability.extensionName) {
        return;
      }
      const methodTable = _getOrCreateMethodTable(
        _extensionCapabilities,
        capability.extensionName
      );
      for (const methodName in capability.methods) {
        if (!Object.prototype.hasOwnProperty.call(capability.methods, methodName)) {
          continue;
        }
        const method = capability.methods[methodName];
        if (typeof method === 'function') {
          methodTable.put(methodName, method);
        }
      }
    };

    export const registerExtensionNamespace = function (
      extensionName: string,
      extensionNamespace: unknown
    ): void {
      if (!extensionName || !extensionNamespace) {
        return;
      }
      const methods: { [methodName: string]: RuntimeCallable } = {};
      for (const methodName in extensionNamespace as {
        [methodName: string]: unknown;
      }) {
        if (
          !Object.prototype.hasOwnProperty.call(extensionNamespace, methodName)
        ) {
          continue;
        }
        const method = (extensionNamespace as { [key: string]: unknown })[
          methodName
        ];
        if (typeof method === 'function') {
          methods[methodName] = method as RuntimeCallable;
        }
      }
      gdjs.runtimeCapabilities.registerExtensionCapability({
        extensionName,
        methods,
      });
    };

    export const autoRegisterKnownExtensionNamespaces = function (): void {
      const extensionNames = gdjs.getRegisteredExtensionNames();
      for (const extensionName of extensionNames) {
        const extensionNamespace = _resolveExtensionNamespace(extensionName);
        if (!extensionNamespace) {
          continue;
        }
        gdjs.runtimeCapabilities.registerExtensionNamespace(
          extensionName,
          extensionNamespace
        );
      }
    };

    export const unregisterExtensionCapability = function (
      extensionName: string,
      methodName?: string
    ): void {
      if (!_extensionCapabilities.containsKey(extensionName)) {
        return;
      }
      if (!methodName) {
        _extensionCapabilities.remove(extensionName);
        return;
      }
      _extensionCapabilities.get(extensionName).remove(methodName);
    };

    export const listRegisteredExtensionCapabilityNames = function (): string[] {
      const extensionNames: string[] = [];
      _extensionCapabilities.keys(extensionNames);
      extensionNames.sort();
      return extensionNames;
    };

    export const listExtensionMethods = function (
      extensionName: string
    ): string[] {
      const methodNamesByKey: { [key: string]: true } = {};

      const registeredMethods = _extensionCapabilities.get(extensionName);
      if (registeredMethods) {
        for (const methodName in registeredMethods.items) {
          if (
            Object.prototype.hasOwnProperty.call(registeredMethods.items, methodName)
          ) {
            methodNamesByKey[methodName] = true;
          }
        }
      }

      const extensionNamespace = _resolveExtensionNamespace(extensionName) as
        | { [methodName: string]: unknown }
        | null;
      if (extensionNamespace) {
        for (const methodName in extensionNamespace) {
          if (
            Object.prototype.hasOwnProperty.call(extensionNamespace, methodName) &&
            typeof extensionNamespace[methodName] === 'function'
          ) {
            methodNamesByKey[methodName] = true;
          }
        }
      }

      const methodNames = Object.keys(methodNamesByKey);
      methodNames.sort();
      return methodNames;
    };

    export const invokeExtensionMethod = function (
      extensionName: string,
      methodName: string,
      ...args: any[]
    ): unknown {
      const registeredMethods = _extensionCapabilities.get(extensionName);
      if (registeredMethods && registeredMethods.containsKey(methodName)) {
        const method = registeredMethods.get(methodName);
        if (typeof method === 'function') {
          return method(...args);
        }
      }

      return _invokeExtensionNamespaceMethod(extensionName, methodName, ...args);
    };

    export const bindManualExtensionToObject = function (
      object: gdjs.RuntimeObject,
      binding: ManualObjectExtensionBinding
    ): void {
      if (!binding || !binding.extensionName) {
        return;
      }
      const objectBindings = _getOrCreateManualBindingsForObject(object);
      objectBindings.put(binding.extensionName, {
        extensionName: binding.extensionName,
        methods: binding.methods || {},
        config: _cloneRecord(binding.config),
        state: _cloneRecord(binding.state),
      });
    };

    export const unbindManualExtensionFromObject = function (
      object: gdjs.RuntimeObject,
      extensionName: string
    ): boolean {
      const objectId = _getObjectId(object);
      const objectBindings = _manualBindingsByObjectId.get(objectId);
      if (!objectBindings || !objectBindings.containsKey(extensionName)) {
        return false;
      }
      objectBindings.remove(extensionName);
      return true;
    };

    export const listManualObjectExtensions = function (
      object: gdjs.RuntimeObject
    ): string[] {
      const objectId = _getObjectId(object);
      const objectBindings = _manualBindingsByObjectId.get(objectId);
      if (!objectBindings) {
        return [];
      }
      const extensionNames: string[] = [];
      objectBindings.keys(extensionNames);
      extensionNames.sort();
      return extensionNames;
    };

    export const setManualObjectExtensionConfig = function (
      object: gdjs.RuntimeObject,
      extensionName: string,
      configPatch: { [key: string]: unknown }
    ): boolean {
      const objectId = _getObjectId(object);
      const objectBindings = _manualBindingsByObjectId.get(objectId);
      if (!objectBindings || !objectBindings.containsKey(extensionName)) {
        return false;
      }
      const binding = objectBindings.get(extensionName);
      binding.config = {
        ..._cloneRecord(binding.config),
        ..._cloneRecord(configPatch),
      };
      return true;
    };

    export const getManualObjectExtensionConfig = function (
      object: gdjs.RuntimeObject,
      extensionName: string
    ): { [key: string]: unknown } | null {
      const objectId = _getObjectId(object);
      const objectBindings = _manualBindingsByObjectId.get(objectId);
      if (!objectBindings || !objectBindings.containsKey(extensionName)) {
        return null;
      }
      return _cloneRecord(objectBindings.get(extensionName).config);
    };

    export const invokeManualObjectExtensionMethod = function (
      object: gdjs.RuntimeObject,
      extensionName: string,
      methodName: string,
      ...args: any[]
    ): unknown {
      const objectId = _getObjectId(object);
      const objectBindings = _manualBindingsByObjectId.get(objectId);
      if (!objectBindings || !objectBindings.containsKey(extensionName)) {
        return undefined;
      }
      const binding = objectBindings.get(extensionName);
      const method = binding.methods[methodName];
      if (typeof method !== 'function') {
        return undefined;
      }
      const context: ManualObjectExtensionContext = {
        object,
        extensionName,
        config: binding.config ? binding.config : {},
        state: binding.state ? binding.state : {},
      };
      return method(context, ...args);
    };

    export const invokeObjectExtensionMethod = function (
      object: gdjs.RuntimeObject,
      extensionName: string,
      methodName: string,
      ...args: any[]
    ): unknown {
      const manualMethodResult = invokeManualObjectExtensionMethod(
        object,
        extensionName,
        methodName,
        ...args
      );
      if (manualMethodResult !== undefined) {
        return manualMethodResult;
      }

      const registeredMethods = _extensionCapabilities.get(extensionName);
      if (registeredMethods && registeredMethods.containsKey(methodName)) {
        const method = registeredMethods.get(methodName);
        if (typeof method === 'function') {
          return method(object, ...args);
        }
      }

      return _invokeExtensionNamespaceMethod(
        extensionName,
        methodName,
        object,
        ...args
      );
    };

    export const getEngineAccess = function (
      source?:
        | gdjs.RuntimeGame
        | gdjs.RuntimeInstanceContainer
        | gdjs.RuntimeScene
        | null
    ): RuntimeEngineAccess {
      const runtimeGame = _resolveRuntimeGame(source);
      const inputManager = runtimeGame ? runtimeGame.getInputManager() : null;
      const renderer = runtimeGame ? runtimeGame.getRenderer() : null;
      const sceneStack = runtimeGame ? runtimeGame.getSceneStack() : null;
      const currentScene = _getCurrentSceneFromRuntimeGame(runtimeGame);
      return {
        gdjs,
        runtimeGame,
        renderer,
        inputManager,
        sceneStack,
        currentScene,
      };
    };

    export const readEnginePath = function (
      path: string,
      source?:
        | gdjs.RuntimeGame
        | gdjs.RuntimeInstanceContainer
        | gdjs.RuntimeScene
        | null
    ): unknown {
      const engineAccess = getEngineAccess(source);
      const root = engineAccess as unknown as { [key: string]: unknown };
      return _resolvePath(root, path).value;
    };

    export const invokeEnginePath = function (
      path: string,
      source?:
        | gdjs.RuntimeGame
        | gdjs.RuntimeInstanceContainer
        | gdjs.RuntimeScene
        | null,
      ...args: any[]
    ): unknown {
      const engineAccess = getEngineAccess(source);
      const root = engineAccess as unknown as { [key: string]: unknown };
      const resolvedPath = _resolvePath(root, path);
      if (typeof resolvedPath.value !== 'function') {
        return undefined;
      }
      return (resolvedPath.value as Function).apply(resolvedPath.owner, args);
    };

    export const getInputSnapshot = function (
      source?:
        | gdjs.RuntimeGame
        | gdjs.RuntimeInstanceContainer
        | gdjs.RuntimeScene
        | null
    ): InputSnapshot {
      const runtimeGame = _resolveRuntimeGame(source);
      const inputManager = runtimeGame ? runtimeGame.getInputManager() : null;
      if (!inputManager) {
        return {
          keyboard: {
            lastPressedKey: 0,
            pressedKeys: [],
            justPressedKeys: [],
            releasedKeys: [],
          },
          mouse: {
            x: 0,
            y: 0,
            cursorX: 0,
            cursorY: 0,
            movementX: 0,
            movementY: 0,
            insideCanvas: false,
            wheelDeltaX: 0,
            wheelDeltaY: 0,
            wheelDeltaZ: 0,
            pressedButtons: [],
            releasedButtons: [],
          },
          touch: {
            simulateMouse: true,
            startedTouches: [],
            touches: [],
          },
          gamepads: _getGamepadsSnapshot(),
        };
      }

      const inputManagerAny = inputManager as any;
      const touchIds = inputManager.getAllTouchIdentifiers();
      const touchSnapshots: InputTouchSnapshot[] = touchIds.map((id) => ({
        id,
        x: inputManager.getTouchX(id),
        y: inputManager.getTouchY(id),
        justEnded: inputManager.hasTouchEnded(id),
        isMouseTouch: id === gdjs.InputManager.MOUSE_TOUCH_ID,
      }));

      return {
        keyboard: {
          lastPressedKey: inputManager.getLastPressedKey(),
          pressedKeys: _listTruthyNumericKeys(inputManagerAny._pressedKeys?.items),
          justPressedKeys: inputManager.exceptionallyGetAllJustPressedKeys(),
          releasedKeys: _listTruthyNumericKeys(
            inputManagerAny._releasedKeys?.items
          ),
        },
        mouse: {
          x: inputManager.getMouseX(),
          y: inputManager.getMouseY(),
          cursorX: inputManager.getCursorX(),
          cursorY: inputManager.getCursorY(),
          movementX: inputManager.getMouseMovementX(),
          movementY: inputManager.getMouseMovementY(),
          insideCanvas: inputManager.isMouseInsideCanvas(),
          wheelDeltaX: inputManager.getMouseWheelDeltaX(),
          wheelDeltaY: inputManager.getMouseWheelDelta(),
          wheelDeltaZ: inputManager.getMouseWheelDeltaZ(),
          pressedButtons: _listTruthyNumericKeys(
            inputManagerAny._pressedMouseButtons
          ),
          releasedButtons: _listTruthyNumericKeys(
            inputManagerAny._releasedMouseButtons
          ),
        },
        touch: {
          simulateMouse: inputManager.isSimulatingMouseWithTouch(),
          startedTouches: [...inputManager.getStartedTouchIdentifiers()],
          touches: touchSnapshots,
        },
        gamepads: _getGamepadsSnapshot(),
      };
    };

    export const listPressedKeys = function (
      source?:
        | gdjs.RuntimeGame
        | gdjs.RuntimeInstanceContainer
        | gdjs.RuntimeScene
        | null
    ): number[] {
      return getInputSnapshot(source).keyboard.pressedKeys;
    };

    export const listActiveTouches = function (
      source?:
        | gdjs.RuntimeGame
        | gdjs.RuntimeInstanceContainer
        | gdjs.RuntimeScene
        | null
    ): InputTouchSnapshot[] {
      return getInputSnapshot(source).touch.touches;
    };

    export const listConnectedGamepads = function (): InputGamepadSnapshot[] {
      return _getGamepadsSnapshot().filter((gamepad) => gamepad.connected);
    };

    export const setKeyPressed = function (
      source:
        | gdjs.RuntimeGame
        | gdjs.RuntimeInstanceContainer
        | gdjs.RuntimeScene
        | null,
      keyCode: number,
      location?: number
    ): boolean {
      const runtimeGame = _resolveRuntimeGame(source);
      if (!runtimeGame) {
        return false;
      }
      runtimeGame.getInputManager().onKeyPressed(keyCode, location);
      return true;
    };

    export const setKeyReleased = function (
      source:
        | gdjs.RuntimeGame
        | gdjs.RuntimeInstanceContainer
        | gdjs.RuntimeScene
        | null,
      keyCode: number,
      location?: number
    ): boolean {
      const runtimeGame = _resolveRuntimeGame(source);
      if (!runtimeGame) {
        return false;
      }
      runtimeGame.getInputManager().onKeyReleased(keyCode, location);
      return true;
    };

    export const setMousePosition = function (
      source:
        | gdjs.RuntimeGame
        | gdjs.RuntimeInstanceContainer
        | gdjs.RuntimeScene
        | null,
      x: number,
      y: number,
      movementX?: number,
      movementY?: number
    ): boolean {
      const runtimeGame = _resolveRuntimeGame(source);
      if (!runtimeGame) {
        return false;
      }
      runtimeGame.getInputManager().onMouseMove(x, y, {
        movementX: movementX || 0,
        movementY: movementY || 0,
      });
      return true;
    };

    export const setMouseButtonPressed = function (
      source:
        | gdjs.RuntimeGame
        | gdjs.RuntimeInstanceContainer
        | gdjs.RuntimeScene
        | null,
      buttonCode: number
    ): boolean {
      const runtimeGame = _resolveRuntimeGame(source);
      if (!runtimeGame) {
        return false;
      }
      runtimeGame.getInputManager().onMouseButtonPressed(buttonCode);
      return true;
    };

    export const setMouseButtonReleased = function (
      source:
        | gdjs.RuntimeGame
        | gdjs.RuntimeInstanceContainer
        | gdjs.RuntimeScene
        | null,
      buttonCode: number
    ): boolean {
      const runtimeGame = _resolveRuntimeGame(source);
      if (!runtimeGame) {
        return false;
      }
      runtimeGame.getInputManager().onMouseButtonReleased(buttonCode);
      return true;
    };

    export const setMouseWheelDelta = function (
      source:
        | gdjs.RuntimeGame
        | gdjs.RuntimeInstanceContainer
        | gdjs.RuntimeScene
        | null,
      deltaY: number,
      deltaX?: number,
      deltaZ?: number
    ): boolean {
      const runtimeGame = _resolveRuntimeGame(source);
      if (!runtimeGame) {
        return false;
      }
      runtimeGame.getInputManager().onMouseWheel(
        deltaY,
        deltaX || 0,
        deltaZ || 0
      );
      return true;
    };

    export const setTouchStarted = function (
      source:
        | gdjs.RuntimeGame
        | gdjs.RuntimeInstanceContainer
        | gdjs.RuntimeScene
        | null,
      rawIdentifier: number,
      x: number,
      y: number
    ): boolean {
      const runtimeGame = _resolveRuntimeGame(source);
      if (!runtimeGame) {
        return false;
      }
      runtimeGame.getInputManager().onTouchStart(rawIdentifier, x, y);
      return true;
    };

    export const setTouchMoved = function (
      source:
        | gdjs.RuntimeGame
        | gdjs.RuntimeInstanceContainer
        | gdjs.RuntimeScene
        | null,
      rawIdentifier: number,
      x: number,
      y: number
    ): boolean {
      const runtimeGame = _resolveRuntimeGame(source);
      if (!runtimeGame) {
        return false;
      }
      runtimeGame.getInputManager().onTouchMove(rawIdentifier, x, y);
      return true;
    };

    export const setTouchEnded = function (
      source:
        | gdjs.RuntimeGame
        | gdjs.RuntimeInstanceContainer
        | gdjs.RuntimeScene
        | null,
      rawIdentifier: number
    ): boolean {
      const runtimeGame = _resolveRuntimeGame(source);
      if (!runtimeGame) {
        return false;
      }
      runtimeGame.getInputManager().onTouchEnd(rawIdentifier);
      return true;
    };

    export const setTouchSimulationForMouse = function (
      source:
        | gdjs.RuntimeGame
        | gdjs.RuntimeInstanceContainer
        | gdjs.RuntimeScene
        | null,
      enable: boolean
    ): boolean {
      const runtimeGame = _resolveRuntimeGame(source);
      if (!runtimeGame) {
        return false;
      }
      runtimeGame.getInputManager().touchSimulateMouse(enable);
      return true;
    };

    gdjs.registerObjectDeletedFromSceneCallback(
      (_instanceContainer, runtimeObject) => {
        _manualBindingsByObjectId.remove(_getObjectId(runtimeObject));
      }
    );
  }
}
