// @flow
import { getInstanceInLayoutWithPersistentUuid } from '../Utils/Layout';

const gd: libGDevelop = global.gd;

export type InstancesIndex = {|
  instances: Array<gdInitialInstance>,
  instancesByPersistentUuid: Map<string, gdInitialInstance>,
  childrenByParentPersistentUuid: Map<string, Array<gdInitialInstance>>,
|};

const toRad = (degrees: number): number => (degrees * Math.PI) / 180;

let keepWorldOnReparent = true;

export const getKeepWorldOnReparent = (): boolean => keepWorldOnReparent;

export const setKeepWorldOnReparent = (value: boolean) => {
  keepWorldOnReparent = value;
};

export const getParentPersistentUuid = (
  instance: gdInitialInstance
): string | null => {
  // Keep compatibility with runtimes that don't expose parenting accessors.
  // $FlowFixMe[prop-missing]
  if (typeof instance.getParentPersistentUuid !== 'function') return null;
  const parentPersistentUuid = instance.getParentPersistentUuid();
  return parentPersistentUuid ? parentPersistentUuid : null;
};

const hasMethod = (
  instance: gdInitialInstance,
  methodName: string
): boolean =>
  // $FlowFixMe[prop-missing] - Accessing methods dynamically for compatibility checks.
  typeof instance[methodName] === 'function';

export const getLocalX = (instance: gdInitialInstance): number =>
  hasMethod(instance, 'getLocalX')
    ? // $FlowFixMe[prop-missing]
      instance.getLocalX()
    : instance.getX();

export const getLocalY = (instance: gdInitialInstance): number =>
  hasMethod(instance, 'getLocalY')
    ? // $FlowFixMe[prop-missing]
      instance.getLocalY()
    : instance.getY();

export const getLocalZ = (instance: gdInitialInstance): number =>
  hasMethod(instance, 'getLocalZ')
    ? // $FlowFixMe[prop-missing]
      instance.getLocalZ()
    : instance.getZ();

export const getLocalAngle = (instance: gdInitialInstance): number =>
  hasMethod(instance, 'getLocalAngle')
    ? // $FlowFixMe[prop-missing]
      instance.getLocalAngle()
    : instance.getAngle();

export const getLocalRotationX = (instance: gdInitialInstance): number =>
  hasMethod(instance, 'getLocalRotationX')
    ? // $FlowFixMe[prop-missing]
      instance.getLocalRotationX()
    : instance.getRotationX();

export const getLocalRotationY = (instance: gdInitialInstance): number =>
  hasMethod(instance, 'getLocalRotationY')
    ? // $FlowFixMe[prop-missing]
      instance.getLocalRotationY()
    : instance.getRotationY();

export const setLocalX = (instance: gdInitialInstance, value: number) => {
  if (hasMethod(instance, 'setLocalX')) {
    // $FlowFixMe[prop-missing]
    instance.setLocalX(value);
  }
};

export const setLocalY = (instance: gdInitialInstance, value: number) => {
  if (hasMethod(instance, 'setLocalY')) {
    // $FlowFixMe[prop-missing]
    instance.setLocalY(value);
  }
};

export const setLocalZ = (instance: gdInitialInstance, value: number) => {
  if (hasMethod(instance, 'setLocalZ')) {
    // $FlowFixMe[prop-missing]
    instance.setLocalZ(value);
  }
};

export const setLocalAngle = (instance: gdInitialInstance, value: number) => {
  if (hasMethod(instance, 'setLocalAngle')) {
    // $FlowFixMe[prop-missing]
    instance.setLocalAngle(value);
  }
};

export const setLocalRotationX = (
  instance: gdInitialInstance,
  value: number
) => {
  if (hasMethod(instance, 'setLocalRotationX')) {
    // $FlowFixMe[prop-missing]
    instance.setLocalRotationX(value);
  }
};

export const setLocalRotationY = (
  instance: gdInitialInstance,
  value: number
) => {
  if (hasMethod(instance, 'setLocalRotationY')) {
    // $FlowFixMe[prop-missing]
    instance.setLocalRotationY(value);
  }
};

export const setParentPersistentUuid = (
  instance: gdInitialInstance,
  parentPersistentUuid: string
) => {
  if (hasMethod(instance, 'setParentPersistentUuid')) {
    // $FlowFixMe[prop-missing]
    instance.setParentPersistentUuid(parentPersistentUuid);
  }
};

export const setInheritRotation = (
  instance: gdInitialInstance,
  value: boolean
) => {
  if (hasMethod(instance, 'setInheritRotation')) {
    // $FlowFixMe[prop-missing]
    instance.setInheritRotation(value);
  }
};

export const setInheritScale = (
  instance: gdInitialInstance,
  value: boolean
) => {
  if (hasMethod(instance, 'setInheritScale')) {
    // $FlowFixMe[prop-missing]
    instance.setInheritScale(value);
  }
};

export const buildInstancesIndex = (
  initialInstancesContainer: gdInitialInstancesContainer
): InstancesIndex => {
  const instances: Array<gdInitialInstance> = [];
  const instancesByPersistentUuid: Map<string, gdInitialInstance> = new Map();
  const childrenByParentPersistentUuid: Map<
    string,
    Array<gdInitialInstance>
  > = new Map();

  if (
    !initialInstancesContainer ||
    initialInstancesContainer.getInstancesCount() === 0
  ) {
    return {
      instances,
      instancesByPersistentUuid,
      childrenByParentPersistentUuid,
    };
  }

  const instanceGetter = new gd.InitialInstanceJSFunctor();
  // $FlowFixMe[incompatible-type] - invoke is not writable
  // $FlowFixMe[cannot-write]
  instanceGetter.invoke = instancePtr => {
    // $FlowFixMe[incompatible-type] - wrapPointer is not exposed
    const instance: gdInitialInstance = gd.wrapPointer(
      // $FlowFixMe[incompatible-type]
      instancePtr,
      gd.InitialInstance
    );
    instances.push(instance);
    instancesByPersistentUuid.set(instance.getPersistentUuid(), instance);
  };
  // $FlowFixMe[incompatible-type] - JSFunctor is incompatible with Functor
  initialInstancesContainer.iterateOverInstances(instanceGetter);
  instanceGetter.delete();

  instances.forEach(instance => {
    const parentPersistentUuid = getParentPersistentUuid(instance);
    if (!parentPersistentUuid) return;
    let children = childrenByParentPersistentUuid.get(parentPersistentUuid);
    if (!children) {
      children = [];
      childrenByParentPersistentUuid.set(parentPersistentUuid, children);
    }
    children.push(instance);
  });

  return {
    instances,
    instancesByPersistentUuid,
    childrenByParentPersistentUuid,
  };
};

export const getParentInstanceFromIndex = (
  instance: gdInitialInstance,
  instancesIndex: InstancesIndex
): gdInitialInstance | null => {
  const parentPersistentUuid = getParentPersistentUuid(instance);
  if (!parentPersistentUuid) return null;
  return (
    instancesIndex.instancesByPersistentUuid.get(parentPersistentUuid) || null
  );
};

export const getParentInstance = (
  instance: gdInitialInstance,
  initialInstancesContainer: gdInitialInstancesContainer
): gdInitialInstance | null => {
  const parentPersistentUuid = getParentPersistentUuid(instance);
  if (!parentPersistentUuid) return null;
  return getInstanceInLayoutWithPersistentUuid(
    initialInstancesContainer,
    parentPersistentUuid
  );
};

const getLocalScaleX = (instance: gdInitialInstance): number =>
  // $FlowFixMe[prop-missing]
  typeof instance.getLocalScaleX === 'function' ? instance.getLocalScaleX() : 1;

const getLocalScaleY = (instance: gdInitialInstance): number =>
  // $FlowFixMe[prop-missing]
  typeof instance.getLocalScaleY === 'function' ? instance.getLocalScaleY() : 1;

export const setLocalScaleX = (instance: gdInitialInstance, value: number) => {
  if (hasMethod(instance, 'setLocalScaleX')) {
    // $FlowFixMe[prop-missing]
    instance.setLocalScaleX(value);
  }
};

export const setLocalScaleY = (instance: gdInitialInstance, value: number) => {
  if (hasMethod(instance, 'setLocalScaleY')) {
    // $FlowFixMe[prop-missing]
    instance.setLocalScaleY(value);
  }
};

const getInheritRotation = (instance: gdInitialInstance): boolean =>
  // $FlowFixMe[prop-missing]
  typeof instance.inheritRotation === 'function'
    ? instance.inheritRotation()
    : true;

const getInheritScale = (instance: gdInitialInstance): boolean =>
  // $FlowFixMe[prop-missing]
  typeof instance.inheritScale === 'function' ? instance.inheritScale() : true;

export const getInstanceWorldScaleX = (
  instance: gdInitialInstance,
  instancesByPersistentUuid: Map<string, gdInitialInstance>,
  visited?: Set<string>
): number => {
  const uuid = instance.getPersistentUuid();
  const nextVisited = visited || new Set();
  if (nextVisited.has(uuid)) return getLocalScaleX(instance);
  nextVisited.add(uuid);

  const localScaleX = getLocalScaleX(instance);
  if (!getInheritScale(instance)) return localScaleX;
  const parentPersistentUuid = getParentPersistentUuid(instance);
  if (!parentPersistentUuid) return localScaleX;
  const parentInstance = instancesByPersistentUuid.get(parentPersistentUuid);
  if (!parentInstance) return localScaleX;

  return (
    getInstanceWorldScaleX(
      parentInstance,
      instancesByPersistentUuid,
      nextVisited
    ) * localScaleX
  );
};

export const getInstanceWorldScaleY = (
  instance: gdInitialInstance,
  instancesByPersistentUuid: Map<string, gdInitialInstance>,
  visited?: Set<string>
): number => {
  const uuid = instance.getPersistentUuid();
  const nextVisited = visited || new Set();
  if (nextVisited.has(uuid)) return getLocalScaleY(instance);
  nextVisited.add(uuid);

  const localScaleY = getLocalScaleY(instance);
  if (!getInheritScale(instance)) return localScaleY;
  const parentPersistentUuid = getParentPersistentUuid(instance);
  if (!parentPersistentUuid) return localScaleY;
  const parentInstance = instancesByPersistentUuid.get(parentPersistentUuid);
  if (!parentInstance) return localScaleY;

  return (
    getInstanceWorldScaleY(
      parentInstance,
      instancesByPersistentUuid,
      nextVisited
    ) * localScaleY
  );
};

export const setLocalToWorld = (
  instance: gdInitialInstance,
  worldScaleX?: number,
  worldScaleY?: number
) => {
  setLocalX(instance, instance.getX());
  setLocalY(instance, instance.getY());
  setLocalZ(instance, instance.getZ());
  setLocalAngle(instance, instance.getAngle());
  setLocalRotationX(instance, instance.getRotationX());
  setLocalRotationY(instance, instance.getRotationY());
  setLocalScaleX(
    instance,
    worldScaleX !== undefined ? worldScaleX : getLocalScaleX(instance)
  );
  setLocalScaleY(
    instance,
    worldScaleY !== undefined ? worldScaleY : getLocalScaleY(instance)
  );
};

export const applyLocalToWorld = (instance: gdInitialInstance) => {
  instance.setX(getLocalX(instance));
  instance.setY(getLocalY(instance));
  instance.setZ(getLocalZ(instance));
  instance.setAngle(getLocalAngle(instance));
  instance.setRotationX(getLocalRotationX(instance));
  instance.setRotationY(getLocalRotationY(instance));
};

export const recomputeLocalFromWorld = (
  instance: gdInitialInstance,
  parent: gdInitialInstance,
  instancesByPersistentUuid: Map<string, gdInitialInstance>
) => {
  const inheritRotation = getInheritRotation(instance);
  const inheritScale = getInheritScale(instance);

  let dx = instance.getX() - parent.getX();
  let dy = instance.getY() - parent.getY();
  let dz = instance.getZ() - parent.getZ();

  if (inheritRotation) {
    const rotX = toRad(parent.getRotationX());
    const rotY = toRad(parent.getRotationY());
    const rotZ = toRad(parent.getAngle());

    // Inverse rotation (ZYX order): apply -Z, -Y, -X.
    const cosZ = Math.cos(-rotZ);
    const sinZ = Math.sin(-rotZ);
    let x1 = dx * cosZ - dy * sinZ;
    let y1 = dx * sinZ + dy * cosZ;
    let z1 = dz;

    const cosY = Math.cos(-rotY);
    const sinY = Math.sin(-rotY);
    let x2 = x1 * cosY + z1 * sinY;
    let y2 = y1;
    let z2 = -x1 * sinY + z1 * cosY;

    const cosX = Math.cos(-rotX);
    const sinX = Math.sin(-rotX);
    let x3 = x2;
    let y3 = y2 * cosX - z2 * sinX;
    let z3 = y2 * sinX + z2 * cosX;

    dx = x3;
    dy = y3;
    dz = z3;
  }

  if (inheritScale) {
    const parentScaleX = getInstanceWorldScaleX(
      parent,
      instancesByPersistentUuid
    );
    const parentScaleY = getInstanceWorldScaleY(
      parent,
      instancesByPersistentUuid
    );
    if (parentScaleX !== 0) {
      dx /= parentScaleX;
      dz /= parentScaleX;
    }
    if (parentScaleY !== 0) {
      dy /= parentScaleY;
    }
  }

  setLocalX(instance, dx);
  setLocalY(instance, dy);
  setLocalZ(instance, dz);

  if (inheritRotation) {
    setLocalAngle(instance, instance.getAngle() - parent.getAngle());
    setLocalRotationX(instance, instance.getRotationX() - parent.getRotationX());
    setLocalRotationY(instance, instance.getRotationY() - parent.getRotationY());
  } else {
    setLocalAngle(instance, instance.getAngle());
    setLocalRotationX(instance, instance.getRotationX());
    setLocalRotationY(instance, instance.getRotationY());
  }
};

export const applyParentTransformFromLocal = (
  instance: gdInitialInstance,
  parent: gdInitialInstance,
  instancesByPersistentUuid: Map<string, gdInitialInstance>
) => {
  const inheritRotation = getInheritRotation(instance);
  const inheritScale = getInheritScale(instance);

  let x = getLocalX(instance);
  let y = getLocalY(instance);
  let z = getLocalZ(instance);

  if (inheritScale) {
    const parentScaleX = getInstanceWorldScaleX(
      parent,
      instancesByPersistentUuid
    );
    const parentScaleY = getInstanceWorldScaleY(
      parent,
      instancesByPersistentUuid
    );
    x *= parentScaleX;
    y *= parentScaleY;
    z *= parentScaleX;
  }

  if (inheritRotation) {
    const rotX = toRad(parent.getRotationX());
    const rotY = toRad(parent.getRotationY());
    const rotZ = toRad(parent.getAngle());

    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    let x1 = x;
    let y1 = y * cosX - z * sinX;
    let z1 = y * sinX + z * cosX;

    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    let x2 = x1 * cosY + z1 * sinY;
    let y2 = y1;
    let z2 = -x1 * sinY + z1 * cosY;

    const cosZ = Math.cos(rotZ);
    const sinZ = Math.sin(rotZ);
    let x3 = x2 * cosZ - y2 * sinZ;
    let y3 = x2 * sinZ + y2 * cosZ;
    let z3 = z2;

    x = x3;
    y = y3;
    z = z3;
  }

  const worldX = parent.getX() + x;
  const worldY = parent.getY() + y;
  const worldZ = parent.getZ() + z;

  let worldAngle = getLocalAngle(instance);
  let worldRotationX = getLocalRotationX(instance);
  let worldRotationY = getLocalRotationY(instance);
  if (inheritRotation) {
    worldAngle += parent.getAngle();
    worldRotationX += parent.getRotationX();
    worldRotationY += parent.getRotationY();
  }

  instance.setX(worldX);
  instance.setY(worldY);
  instance.setZ(worldZ);
  instance.setAngle(worldAngle);
  instance.setRotationX(worldRotationX);
  instance.setRotationY(worldRotationY);
};

export const syncLocalFromWorld = (
  instance: gdInitialInstance,
  instancesIndex: InstancesIndex
) => {
  const parentInstance = getParentInstanceFromIndex(instance, instancesIndex);
  if (parentInstance) {
    recomputeLocalFromWorld(
      instance,
      parentInstance,
      instancesIndex.instancesByPersistentUuid
    );
  } else {
    const worldScaleX = getInstanceWorldScaleX(
      instance,
      instancesIndex.instancesByPersistentUuid
    );
    const worldScaleY = getInstanceWorldScaleY(
      instance,
      instancesIndex.instancesByPersistentUuid
    );
    setLocalToWorld(instance, worldScaleX, worldScaleY);
  }
};

export const applyParentTransformToDescendants = (
  parentInstance: gdInitialInstance,
  instancesIndex: InstancesIndex
) => {
  const {
    childrenByParentPersistentUuid,
    instancesByPersistentUuid,
  } = instancesIndex;
  const visited = new Set();

  const applyRecursively = (instance: gdInitialInstance) => {
    const instanceUuid = instance.getPersistentUuid();
    if (visited.has(instanceUuid)) return;
    visited.add(instanceUuid);

    const children = childrenByParentPersistentUuid.get(instanceUuid);
    if (!children || children.length === 0) return;
    children.forEach(child => {
      applyParentTransformFromLocal(child, instance, instancesByPersistentUuid);
      applyRecursively(child);
    });
  };

  applyRecursively(parentInstance);
};

export const collectDescendants = (
  parentInstance: gdInitialInstance,
  instancesIndex: InstancesIndex
): Array<gdInitialInstance> => {
  const { childrenByParentPersistentUuid } = instancesIndex;
  const descendants: Array<gdInitialInstance> = [];
  const visited = new Set();

  const collectRecursively = (instance: gdInitialInstance) => {
    const instanceUuid = instance.getPersistentUuid();
    if (visited.has(instanceUuid)) return;
    visited.add(instanceUuid);

    const children = childrenByParentPersistentUuid.get(instanceUuid);
    if (!children || children.length === 0) return;
    children.forEach(child => {
      descendants.push(child);
      collectRecursively(child);
    });
  };

  collectRecursively(parentInstance);
  return descendants;
};
