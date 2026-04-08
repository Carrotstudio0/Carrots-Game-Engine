// @ts-check
describe('gdjs.NavMeshRuntimeBehavior', function () {
  /**
   * @typedef {gdjs.RuntimeObject & {
   *   get3DRendererObject: () => THREE.Object3D,
   *   getZ: () => number,
   *   setZ: (z: number) => void,
   *   getRotationX: () => number,
   *   getRotationY: () => number
   * }} NavMeshTestRuntimeObject
   */

  const createScene = () => {
    const runtimeGame = gdjs.getPixiRuntimeGame();
    const runtimeScene = new gdjs.RuntimeScene(runtimeGame);
    runtimeScene.loadFromScene({
      sceneData: {
        layers: [
          {
            name: '',
            visibility: true,
            effects: [],
            cameras: [],
            ambientLightColorR: 0,
            ambientLightColorG: 0,
            ambientLightColorB: 0,
            isLightingLayer: false,
            followBaseLayerCamera: true,
          },
        ],
        variables: [],
        r: 0,
        v: 0,
        b: 0,
        mangledName: 'NavMeshScene',
        name: 'NavMeshScene',
        stopSoundsOnStartup: false,
        title: '',
        behaviorsSharedData: [],
        objects: [],
        instances: [],
        usedResources: [],
        uiSettings: {
          grid: false,
          gridType: 'rectangular',
          gridWidth: 10,
          gridHeight: 10,
          gridDepth: 10,
          gridOffsetX: 0,
          gridOffsetY: 0,
          gridOffsetZ: 0,
          gridColor: 0,
          gridAlpha: 1,
          snap: false,
        },
      },
      usedExtensionsWithVariablesData: [],
    });
    runtimeScene._timeManager.getElapsedTime = function () {
      return (1 / 60) * 1000;
    };
    return runtimeScene;
  };

  const add3DObjectWithBehavior = (
    runtimeScene,
    objectName,
    behaviorData,
    object3D
  ) => {
    /** @type {NavMeshTestRuntimeObject} */
    const runtimeObject = /** @type {any} */ (
      new gdjs.RuntimeObject(
        runtimeScene,
        {
          name: objectName,
          type: '',
          behaviors: [behaviorData],
          effects: [],
          variables: [],
        },
        undefined
      )
    );

    let z = object3D.position.z;
    const setX = runtimeObject.setX.bind(runtimeObject);
    const setY = runtimeObject.setY.bind(runtimeObject);
    runtimeObject.setX = function (x) {
      setX(x);
      object3D.position.x = x;
    };
    runtimeObject.setY = function (y) {
      setY(y);
      object3D.position.y = y;
    };

    runtimeObject.get3DRendererObject = function () {
      return object3D;
    };
    runtimeObject.getZ = function () {
      return z;
    };
    runtimeObject.setZ = function (value) {
      z = value;
      object3D.position.z = value;
    };
    runtimeObject.getRotationX = function () {
      return gdjs.toDegrees(object3D.rotation.x);
    };
    runtimeObject.getRotationY = function () {
      return gdjs.toDegrees(object3D.rotation.y);
    };
    runtimeObject.getWidth = function () {
      return 64;
    };
    runtimeObject.getHeight = function () {
      return 64;
    };

    runtimeScene.addObject(runtimeObject);
    return runtimeObject;
  };

  const addSurface = (runtimeScene, name, size) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size, 20, 20),
      new THREE.MeshBasicMaterial()
    );
    mesh.position.set(0, 0, 0);
    return add3DObjectWithBehavior(
      runtimeScene,
      `${name}Surface`,
      {
        type: 'NavMeshBehavior::NavMeshSurfaceBehavior',
        name,
        enabled: true,
        maxSlope: 89,
        areaCost: 1,
        dynamic: true,
        refreshIntervalFrames: 5,
        debugMeshEnabled: false,
        debugMeshColor: 0x33ccff,
      },
      mesh
    );
  };

  const addObstacle = (runtimeScene, name, width, height, depth) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshBasicMaterial()
    );
    mesh.position.set(0, 0, 0);
    return add3DObjectWithBehavior(
      runtimeScene,
      `${name}Obstacle`,
      {
        type: 'NavMeshBehavior::NavMeshObstacleBehavior',
        name,
        enabled: true,
        margin: 0,
        dynamic: true,
        refreshIntervalFrames: 3,
      },
      mesh
    );
  };

  const addAgent = (runtimeScene, name) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(10),
      new THREE.MeshBasicMaterial()
    );
    mesh.position.set(0, 0, 0);
    return add3DObjectWithBehavior(
      runtimeScene,
      `${name}Agent`,
      {
        type: 'NavMeshBehavior::NavMeshAgentBehavior',
        name,
        enabled: true,
        speed: 260,
        acceleration: 1200,
        stoppingDistance: 4,
        autoRepath: true,
        repathIntervalSeconds: 0.2,
        rotateToVelocity: false,
        projectOnNavMesh: true,
        avoidanceEnabled: false,
        avoidanceRadius: 0,
        avoidanceStrength: 0,
      },
      mesh
    );
  };

  it('finds a path and exposes destination/waypoint expressions', function () {
    const runtimeScene = createScene();
    addSurface(runtimeScene, 'surface', 1200);
    const agent = addAgent(runtimeScene, 'agent');
    runtimeScene.renderAndStep(1000 / 60);

    agent.setPosition(-240, 0);
    agent.setZ(0);

    /** @type {gdjs.NavMeshAgentRuntimeBehavior} */
    const behavior = /** @type {any} */ (agent.getBehavior('agent'));
    behavior.setDestination(240, 0, 0);
    for (let i = 0; i < 30 && !behavior.isPathFound(); i++) {
      runtimeScene.renderAndStep(1000 / 60);
    }

    expect(behavior.hasDestination()).to.be(true);
    expect(behavior.isPathFound()).to.be(true);
    expect(behavior.getNodeCount()).to.be.above(1);
    expect(behavior.getDestinationX()).to.be.within(239.9, 240.1);
    expect(behavior.getDestinationY()).to.be(0);
    expect(behavior.getDestinationZ()).to.be(0);
    expect(behavior.getNextNodeIndex()).to.be.within(
      0,
      behavior.getNodeCount() - 1
    );
    expect(behavior.getNextNodeX()).to.not.be(undefined);
    expect(behavior.getLastNodeX()).to.be.within(239.9, 240.1);
    expect(behavior.movementAngleIsAround(0, 180)).to.be(true);
  });

  it('reaches destination and clears destination state cleanly', function () {
    const runtimeScene = createScene();
    addSurface(runtimeScene, 'surface', 1200);
    const agent = addAgent(runtimeScene, 'agent');
    runtimeScene.renderAndStep(1000 / 60);

    agent.setPosition(-200, -40);
    agent.setZ(0);

    /** @type {gdjs.NavMeshAgentRuntimeBehavior} */
    const behavior = /** @type {any} */ (agent.getBehavior('agent'));
    behavior.setDestination(260, -40, 0);
    for (let i = 0; i < 30 && !behavior.isPathFound(); i++) {
      runtimeScene.renderAndStep(1000 / 60);
    }

    let reached = false;
    for (let i = 0; i < 360; i++) {
      runtimeScene.renderAndStep(1000 / 60);
      if (behavior.destinationReached()) {
        reached = true;
        break;
      }
    }

    expect(reached).to.be(true);
    expect(behavior.getRemainingDistance()).to.be.below(behavior.getStoppingDistance() + 1);

    behavior.clearDestination();
    expect(behavior.hasDestination()).to.be(false);
    expect(behavior.isMoving()).to.be(false);
    expect(behavior.getNodeCount()).to.be(0);
  });

  it('fails pathfinding when an obstacle blocks the full walkable area', function () {
    const runtimeScene = createScene();
    addSurface(runtimeScene, 'surface', 300);
    addObstacle(runtimeScene, 'obstacle', 900, 900, 300);
    const agent = addAgent(runtimeScene, 'agent');
    runtimeScene.renderAndStep(1000 / 60);

    agent.setPosition(-100, 0);
    agent.setZ(0);

    /** @type {gdjs.NavMeshAgentRuntimeBehavior} */
    const behavior = /** @type {any} */ (agent.getBehavior('agent'));
    behavior.setDestination(100, 0, 0);

    expect(behavior.isPathFound()).to.be(false);
    expect(behavior.getNodeCount()).to.be(0);
    expect(behavior.destinationReached()).to.be(false);
  });

  it('updates debug mesh settings for navmesh surface visualization', function () {
    const runtimeScene = createScene();
    const surface = addSurface(runtimeScene, 'surface', 800);
    runtimeScene.renderAndStep(1000 / 60);

    /** @type {gdjs.NavMeshSurfaceRuntimeBehavior} */
    const behavior = /** @type {any} */ (surface.getBehavior('surface'));
    behavior.setDebugMeshEnabled(true);
    behavior.setDebugMeshColor(0x22ffaa);
    runtimeScene.renderAndStep(1000 / 60);

    expect(behavior.isDebugMeshEnabled()).to.be(true);
    expect(behavior.getDebugMeshColor()).to.be(0x22ffaa);

    const manager = gdjs.NavMesh3DManager.getManager(runtimeScene);
    expect(!!manager).to.be(true);
    expect(manager.hasLayerDebugVisualization('')).to.be(true);

    behavior.setDebugMeshEnabled(false);
    runtimeScene.renderAndStep(1000 / 60);
    expect(manager.hasLayerDebugVisualization('')).to.be(false);
  });

  it('updates debug painter settings for the current path', function () {
    const runtimeScene = createScene();
    addSurface(runtimeScene, 'surface', 1000);
    const agent = addAgent(runtimeScene, 'agent');
    runtimeScene.renderAndStep(1000 / 60);

    agent.setPosition(-180, 10);
    agent.setZ(0);

    /** @type {gdjs.NavMeshAgentRuntimeBehavior} */
    const behavior = /** @type {any} */ (agent.getBehavior('agent'));
    behavior.setDebugPathEnabled(true);
    behavior.setDebugPathColor(0xff2200);
    behavior.setDestination(180, 10, 0);

    for (let i = 0; i < 20 && !behavior.isPathFound(); i++) {
      runtimeScene.renderAndStep(1000 / 60);
    }

    expect(behavior.isDebugPathEnabled()).to.be(true);
    expect(behavior.getDebugPathColor()).to.be(0xff2200);

    behavior.setDebugPathEnabled(false);
    expect(behavior.isDebugPathEnabled()).to.be(false);
  });
});
