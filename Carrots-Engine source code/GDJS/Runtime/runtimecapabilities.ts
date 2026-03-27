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

    gdjs.registerObjectDeletedFromSceneCallback(
      (_instanceContainer, runtimeObject) => {
        _manualBindingsByObjectId.remove(_getObjectId(runtimeObject));
      }
    );
  }
}
