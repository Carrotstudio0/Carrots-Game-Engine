//@ts-check
/// <reference path="../JsExtensionTypes.d.ts" />

/** @type {ExtensionModule} */
module.exports = {
  createExtension: function (_, gd) {
    const extension = new gd.PlatformExtension();
    extension
      .setExtensionInformation(
        'NavMeshBehavior',
        _('3D Navmesh'),
        _(
          '3D runtime navmesh with surfaces, obstacles, links and agents.'
        ),
        'Carrots Engine Team',
        'Open source (MIT License)'
      )
      .setShortDescription(
        '3D NavMesh: surfaces, obstacles, links, agents, repath and avoidance.'
      )
      .setDimension('3D')
      .setCategory('Movement')
      .setTags('navmesh, pathfinding, 3d, ai')
      .setExtensionHelpPath('/behaviors/navmesh');

    extension
      .addInstructionOrExpressionGroupMetadata(_('3D Navmesh'))
      .setIcon('CppPlatform/Extensions/AStaricon16.png');

    const runtimeFile = 'Extensions/NavMeshBehavior/navmeshruntimebehavior.js';
    const obstacleRuntimeFile =
      'Extensions/NavMeshBehavior/navmeshobstacleruntimebehavior.js';
    const toolsRuntimeFile = 'Extensions/NavMeshBehavior/NavMeshTools.js';

    const addRuntimeFiles = behavior =>
      behavior
        .setIncludeFile(runtimeFile)
        .addIncludeFile(obstacleRuntimeFile)
        .addIncludeFile(toolsRuntimeFile);

    const asBool = value => value === '1' || value === 'true';
    const toFiniteNumber = (value, fallback) => {
      const numberValue = parseFloat(value);
      return Number.isFinite(numberValue) ? numberValue : fallback;
    };
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const surfaceBehavior = new gd.BehaviorJsImplementation();
    surfaceBehavior.initializeContent = function (behaviorContent) {
      behaviorContent.setBoolAttribute('enabled', true);
      behaviorContent.setDoubleAttribute('maxSlope', 60);
      behaviorContent.setDoubleAttribute('areaCost', 1);
      behaviorContent.setBoolAttribute('dynamic', true);
      behaviorContent.setDoubleAttribute('refreshIntervalFrames', 20);
      behaviorContent.setBoolAttribute('debugMeshEnabled', false);
      behaviorContent.setDoubleAttribute('debugMeshColor', 3394815);
    };
    surfaceBehavior.updateProperty = function (
      behaviorContent,
      propertyName,
      newValue
    ) {
      if (propertyName === 'Enabled') {
        behaviorContent.setBoolAttribute('enabled', asBool(newValue));
        return true;
      }
      if (propertyName === 'Dynamic') {
        behaviorContent.setBoolAttribute('dynamic', asBool(newValue));
        return true;
      }
      if (propertyName === 'DebugMeshEnabled') {
        behaviorContent.setBoolAttribute('debugMeshEnabled', asBool(newValue));
        return true;
      }

      if (propertyName === 'MaxSlope') {
        behaviorContent.setDoubleAttribute(
          'maxSlope',
          clamp(toFiniteNumber(newValue, 60), 0, 89.9)
        );
        return true;
      }
      if (propertyName === 'AreaCost') {
        behaviorContent.setDoubleAttribute(
          'areaCost',
          Math.max(0.001, toFiniteNumber(newValue, 1))
        );
        return true;
      }
      if (propertyName === 'RefreshIntervalFrames') {
        behaviorContent.setDoubleAttribute(
          'refreshIntervalFrames',
          Math.max(1, toFiniteNumber(newValue, 20))
        );
        return true;
      }
      if (propertyName === 'DebugMeshColor') {
        behaviorContent.setDoubleAttribute(
          'debugMeshColor',
          Math.round(clamp(toFiniteNumber(newValue, 3394815), 0, 0xffffff))
        );
        return true;
      }
      return false;
    };
    surfaceBehavior.getProperties = function (behaviorContent) {
      const properties = new gd.MapStringPropertyDescriptor();
      properties
        .getOrCreate('Enabled')
        .setLabel(_('Enabled'))
        .setType('Boolean')
        .setValue(behaviorContent.getBoolAttribute('enabled') ? 'true' : 'false');
      properties
        .getOrCreate('MaxSlope')
        .setLabel(_('Max slope (degrees)'))
        .setType('Number')
        .setMeasurementUnit(gd.MeasurementUnit.getDegreeAngle())
        .setValue(behaviorContent.getDoubleAttribute('maxSlope').toString());
      properties
        .getOrCreate('AreaCost')
        .setLabel(_('Area cost'))
        .setType('Number')
        .setValue(behaviorContent.getDoubleAttribute('areaCost').toString());
      properties
        .getOrCreate('Dynamic')
        .setLabel(_('Dynamic updates'))
        .setGroup(_('Runtime updates'))
        .setAdvanced(true)
        .setType('Boolean')
        .setValue(behaviorContent.getBoolAttribute('dynamic') ? 'true' : 'false');
      properties
        .getOrCreate('RefreshIntervalFrames')
        .setLabel(_('Refresh interval (frames)'))
        .setGroup(_('Runtime updates'))
        .setAdvanced(true)
        .setType('Number')
        .setValue(
          behaviorContent.getDoubleAttribute('refreshIntervalFrames').toString()
        );
      properties
        .getOrCreate('DebugMeshEnabled')
        .setLabel(_('Debug mesh'))
        .setGroup(_('Debug'))
        .setAdvanced(true)
        .setType('Boolean')
        .setValue(
          behaviorContent.getBoolAttribute('debugMeshEnabled') ? 'true' : 'false'
        );
      properties
        .getOrCreate('DebugMeshColor')
        .setLabel(_('Debug mesh color'))
        .setGroup(_('Debug'))
        .setAdvanced(true)
        .setType('Number')
        .setValue(behaviorContent.getDoubleAttribute('debugMeshColor').toString());
      return properties;
    };

    const obstacleBehavior = new gd.BehaviorJsImplementation();
    obstacleBehavior.initializeContent = function (behaviorContent) {
      behaviorContent.setBoolAttribute('enabled', true);
      behaviorContent.setDoubleAttribute('margin', 8);
      behaviorContent.setBoolAttribute('dynamic', true);
      behaviorContent.setDoubleAttribute('refreshIntervalFrames', 10);
    };
    obstacleBehavior.updateProperty = function (
      behaviorContent,
      propertyName,
      newValue
    ) {
      if (propertyName === 'Enabled') {
        behaviorContent.setBoolAttribute('enabled', asBool(newValue));
        return true;
      }
      if (propertyName === 'Dynamic') {
        behaviorContent.setBoolAttribute('dynamic', asBool(newValue));
        return true;
      }
      if (propertyName === 'Margin') {
        behaviorContent.setDoubleAttribute(
          'margin',
          Math.max(0, toFiniteNumber(newValue, 8))
        );
        return true;
      }
      if (propertyName === 'RefreshIntervalFrames') {
        behaviorContent.setDoubleAttribute(
          'refreshIntervalFrames',
          Math.max(1, toFiniteNumber(newValue, 10))
        );
        return true;
      }
      return false;
    };
    obstacleBehavior.getProperties = function (behaviorContent) {
      const properties = new gd.MapStringPropertyDescriptor();
      properties
        .getOrCreate('Enabled')
        .setLabel(_('Enabled'))
        .setType('Boolean')
        .setValue(behaviorContent.getBoolAttribute('enabled') ? 'true' : 'false');
      properties
        .getOrCreate('Margin')
        .setLabel(_('Obstacle margin'))
        .setType('Number')
        .setMeasurementUnit(gd.MeasurementUnit.getPixel())
        .setValue(behaviorContent.getDoubleAttribute('margin').toString());
      properties
        .getOrCreate('Dynamic')
        .setLabel(_('Dynamic updates'))
        .setGroup(_('Runtime updates'))
        .setAdvanced(true)
        .setType('Boolean')
        .setValue(behaviorContent.getBoolAttribute('dynamic') ? 'true' : 'false');
      properties
        .getOrCreate('RefreshIntervalFrames')
        .setLabel(_('Refresh interval (frames)'))
        .setGroup(_('Runtime updates'))
        .setAdvanced(true)
        .setType('Number')
        .setValue(
          behaviorContent.getDoubleAttribute('refreshIntervalFrames').toString()
        );
      return properties;
    };

    const linkBehavior = new gd.BehaviorJsImplementation();
    linkBehavior.initializeContent = function (behaviorContent) {
      behaviorContent.setBoolAttribute('enabled', true);
      behaviorContent.setDoubleAttribute('targetX', 128);
      behaviorContent.setDoubleAttribute('targetY', 0);
      behaviorContent.setDoubleAttribute('targetZ', 0);
      behaviorContent.setBoolAttribute('bidirectional', true);
      behaviorContent.setDoubleAttribute('costMultiplier', 1);
      behaviorContent.setBoolAttribute('dynamic', true);
      behaviorContent.setDoubleAttribute('refreshIntervalFrames', 10);
    };
    linkBehavior.updateProperty = function (
      behaviorContent,
      propertyName,
      newValue
    ) {
      if (propertyName === 'Enabled') {
        behaviorContent.setBoolAttribute('enabled', asBool(newValue));
        return true;
      }
      if (propertyName === 'Bidirectional') {
        behaviorContent.setBoolAttribute('bidirectional', asBool(newValue));
        return true;
      }
      if (propertyName === 'Dynamic') {
        behaviorContent.setBoolAttribute('dynamic', asBool(newValue));
        return true;
      }
      if (propertyName === 'TargetX') {
        behaviorContent.setDoubleAttribute(
          'targetX',
          toFiniteNumber(newValue, 128)
        );
        return true;
      }
      if (propertyName === 'TargetY') {
        behaviorContent.setDoubleAttribute('targetY', toFiniteNumber(newValue, 0));
        return true;
      }
      if (propertyName === 'TargetZ') {
        behaviorContent.setDoubleAttribute('targetZ', toFiniteNumber(newValue, 0));
        return true;
      }
      if (propertyName === 'CostMultiplier') {
        behaviorContent.setDoubleAttribute(
          'costMultiplier',
          clamp(toFiniteNumber(newValue, 1), 0.01, 100)
        );
        return true;
      }
      if (propertyName === 'RefreshIntervalFrames') {
        behaviorContent.setDoubleAttribute(
          'refreshIntervalFrames',
          Math.max(1, toFiniteNumber(newValue, 10))
        );
        return true;
      }
      return false;
    };
    linkBehavior.getProperties = function (behaviorContent) {
      const properties = new gd.MapStringPropertyDescriptor();
      properties
        .getOrCreate('Enabled')
        .setLabel(_('Enabled'))
        .setType('Boolean')
        .setValue(behaviorContent.getBoolAttribute('enabled') ? 'true' : 'false');
      properties
        .getOrCreate('TargetX')
        .setLabel(_('Target X'))
        .setType('Number')
        .setMeasurementUnit(gd.MeasurementUnit.getPixel())
        .setValue(behaviorContent.getDoubleAttribute('targetX').toString());
      properties
        .getOrCreate('TargetY')
        .setLabel(_('Target Y'))
        .setType('Number')
        .setMeasurementUnit(gd.MeasurementUnit.getPixel())
        .setValue(behaviorContent.getDoubleAttribute('targetY').toString());
      properties
        .getOrCreate('TargetZ')
        .setLabel(_('Target Z'))
        .setType('Number')
        .setMeasurementUnit(gd.MeasurementUnit.getPixel())
        .setValue(behaviorContent.getDoubleAttribute('targetZ').toString());
      properties
        .getOrCreate('Bidirectional')
        .setLabel(_('Bidirectional'))
        .setType('Boolean')
        .setValue(
          behaviorContent.getBoolAttribute('bidirectional') ? 'true' : 'false'
        );
      properties
        .getOrCreate('CostMultiplier')
        .setLabel(_('Cost multiplier'))
        .setType('Number')
        .setValue(behaviorContent.getDoubleAttribute('costMultiplier').toString());
      properties
        .getOrCreate('Dynamic')
        .setLabel(_('Dynamic updates'))
        .setGroup(_('Runtime updates'))
        .setAdvanced(true)
        .setType('Boolean')
        .setValue(behaviorContent.getBoolAttribute('dynamic') ? 'true' : 'false');
      properties
        .getOrCreate('RefreshIntervalFrames')
        .setLabel(_('Refresh interval (frames)'))
        .setGroup(_('Runtime updates'))
        .setAdvanced(true)
        .setType('Number')
        .setValue(
          behaviorContent.getDoubleAttribute('refreshIntervalFrames').toString()
        );
      return properties;
    };

    const agentBehavior = new gd.BehaviorJsImplementation();
    agentBehavior.initializeContent = function (behaviorContent) {
      behaviorContent.setBoolAttribute('enabled', true);
      behaviorContent.setDoubleAttribute('speed', 220);
      behaviorContent.setDoubleAttribute('acceleration', 900);
      behaviorContent.setDoubleAttribute('stoppingDistance', 12);
      behaviorContent.setBoolAttribute('autoRepath', true);
      behaviorContent.setDoubleAttribute('repathIntervalSeconds', 0.35);
      behaviorContent.setBoolAttribute('rotateToVelocity', true);
      behaviorContent.setBoolAttribute('projectOnNavMesh', true);
      behaviorContent.setBoolAttribute('avoidanceEnabled', true);
      behaviorContent.setDoubleAttribute('avoidanceRadius', 48);
      behaviorContent.setDoubleAttribute('avoidanceStrength', 0.45);
      behaviorContent.setBoolAttribute('debugPathEnabled', false);
      behaviorContent.setDoubleAttribute('debugPathColor', 58879);
    };
    agentBehavior.updateProperty = function (
      behaviorContent,
      propertyName,
      newValue
    ) {
      if (propertyName === 'Enabled') {
        behaviorContent.setBoolAttribute('enabled', asBool(newValue));
        return true;
      }
      if (propertyName === 'AutoRepath') {
        behaviorContent.setBoolAttribute('autoRepath', asBool(newValue));
        return true;
      }
      if (propertyName === 'RotateToVelocity') {
        behaviorContent.setBoolAttribute('rotateToVelocity', asBool(newValue));
        return true;
      }
      if (propertyName === 'ProjectOnNavMesh') {
        behaviorContent.setBoolAttribute('projectOnNavMesh', asBool(newValue));
        return true;
      }
      if (propertyName === 'AvoidanceEnabled') {
        behaviorContent.setBoolAttribute('avoidanceEnabled', asBool(newValue));
        return true;
      }
      if (propertyName === 'DebugPathEnabled') {
        behaviorContent.setBoolAttribute('debugPathEnabled', asBool(newValue));
        return true;
      }
      if (propertyName === 'Speed') {
        behaviorContent.setDoubleAttribute(
          'speed',
          Math.max(1, toFiniteNumber(newValue, 220))
        );
        return true;
      }
      if (propertyName === 'Acceleration') {
        behaviorContent.setDoubleAttribute(
          'acceleration',
          Math.max(1, toFiniteNumber(newValue, 900))
        );
        return true;
      }
      if (propertyName === 'StoppingDistance') {
        behaviorContent.setDoubleAttribute(
          'stoppingDistance',
          Math.max(0, toFiniteNumber(newValue, 12))
        );
        return true;
      }
      if (propertyName === 'RepathIntervalSeconds') {
        behaviorContent.setDoubleAttribute(
          'repathIntervalSeconds',
          Math.max(0.05, toFiniteNumber(newValue, 0.35))
        );
        return true;
      }
      if (propertyName === 'AvoidanceRadius') {
        behaviorContent.setDoubleAttribute(
          'avoidanceRadius',
          Math.max(0, toFiniteNumber(newValue, 48))
        );
        return true;
      }
      if (propertyName === 'AvoidanceStrength') {
        behaviorContent.setDoubleAttribute(
          'avoidanceStrength',
          clamp(toFiniteNumber(newValue, 0.45), 0, 2)
        );
        return true;
      }
      if (propertyName === 'DebugPathColor') {
        behaviorContent.setDoubleAttribute(
          'debugPathColor',
          Math.round(clamp(toFiniteNumber(newValue, 58879), 0, 0xffffff))
        );
        return true;
      }
      return false;
    };
    agentBehavior.getProperties = function (behaviorContent) {
      const properties = new gd.MapStringPropertyDescriptor();
      properties
        .getOrCreate('Enabled')
        .setLabel(_('Enabled'))
        .setType('Boolean')
        .setValue(behaviorContent.getBoolAttribute('enabled') ? 'true' : 'false');
      properties
        .getOrCreate('Speed')
        .setLabel(_('Speed'))
        .setType('Number')
        .setMeasurementUnit(gd.MeasurementUnit.getPixelSpeed())
        .setValue(behaviorContent.getDoubleAttribute('speed').toString());
      properties
        .getOrCreate('Acceleration')
        .setLabel(_('Acceleration'))
        .setType('Number')
        .setMeasurementUnit(gd.MeasurementUnit.getPixelAcceleration())
        .setValue(behaviorContent.getDoubleAttribute('acceleration').toString());
      properties
        .getOrCreate('StoppingDistance')
        .setLabel(_('Stopping distance'))
        .setType('Number')
        .setMeasurementUnit(gd.MeasurementUnit.getPixel())
        .setValue(behaviorContent.getDoubleAttribute('stoppingDistance').toString());
      properties
        .getOrCreate('AutoRepath')
        .setLabel(_('Auto repath'))
        .setType('Boolean')
        .setValue(
          behaviorContent.getBoolAttribute('autoRepath') ? 'true' : 'false'
        );
      properties
        .getOrCreate('RepathIntervalSeconds')
        .setLabel(_('Repath interval (seconds)'))
        .setType('Number')
        .setValue(
          behaviorContent.getDoubleAttribute('repathIntervalSeconds').toString()
        );
      properties
        .getOrCreate('RotateToVelocity')
        .setLabel(_('Rotate to velocity'))
        .setGroup(_('Advanced'))
        .setAdvanced(true)
        .setType('Boolean')
        .setValue(
          behaviorContent.getBoolAttribute('rotateToVelocity') ? 'true' : 'false'
        );
      properties
        .getOrCreate('ProjectOnNavMesh')
        .setLabel(_('Project on navmesh'))
        .setGroup(_('Advanced'))
        .setAdvanced(true)
        .setType('Boolean')
        .setValue(
          behaviorContent.getBoolAttribute('projectOnNavMesh') ? 'true' : 'false'
        );
      properties
        .getOrCreate('AvoidanceEnabled')
        .setLabel(_('Avoidance enabled'))
        .setGroup(_('Avoidance'))
        .setAdvanced(true)
        .setType('Boolean')
        .setValue(
          behaviorContent.getBoolAttribute('avoidanceEnabled') ? 'true' : 'false'
        );
      properties
        .getOrCreate('AvoidanceRadius')
        .setLabel(_('Avoidance radius'))
        .setGroup(_('Avoidance'))
        .setAdvanced(true)
        .setType('Number')
        .setValue(behaviorContent.getDoubleAttribute('avoidanceRadius').toString());
      properties
        .getOrCreate('AvoidanceStrength')
        .setLabel(_('Avoidance strength'))
        .setGroup(_('Avoidance'))
        .setAdvanced(true)
        .setType('Number')
        .setValue(
          behaviorContent.getDoubleAttribute('avoidanceStrength').toString()
        );
      properties
        .getOrCreate('DebugPathEnabled')
        .setLabel(_('Debug path painter'))
        .setGroup(_('Debug'))
        .setAdvanced(true)
        .setType('Boolean')
        .setValue(
          behaviorContent.getBoolAttribute('debugPathEnabled') ? 'true' : 'false'
        );
      properties
        .getOrCreate('DebugPathColor')
        .setLabel(_('Debug path color'))
        .setGroup(_('Debug'))
        .setAdvanced(true)
        .setType('Number')
        .setValue(behaviorContent.getDoubleAttribute('debugPathColor').toString());
      return properties;
    };

    const surface = extension.addBehavior(
      'NavMeshSurfaceBehavior',
      _('3D Navmesh surface'),
      'NavMeshSurface',
      _('Contribute this 3D object mesh to navmesh generation.'),
      '',
      'CppPlatform/Extensions/AStaricon.png',
      'NavMeshSurfaceBehavior',
      // @ts-ignore
      surfaceBehavior,
      new gd.BehaviorsSharedData()
    );
    addRuntimeFiles(surface);

    const obstacle = extension.addBehavior(
      'NavMeshObstacleBehavior',
      _('3D Navmesh obstacle'),
      'NavMeshObstacle',
      _('Block navmesh triangles using this object 3D bounds.'),
      '',
      'CppPlatform/Extensions/AStaricon.png',
      'NavMeshObstacleBehavior',
      // @ts-ignore
      obstacleBehavior,
      new gd.BehaviorsSharedData()
    );
    addRuntimeFiles(obstacle);

    const link = extension.addBehavior(
      'NavMeshLinkBehavior',
      _('3D Navmesh link'),
      'NavMeshLink',
      _('Create an off-mesh link connecting two 3D positions for agents.'),
      '',
      'CppPlatform/Extensions/AStaricon.png',
      'NavMeshLinkBehavior',
      // @ts-ignore
      linkBehavior,
      new gd.BehaviorsSharedData()
    );
    addRuntimeFiles(link);

    const agent = extension.addBehavior(
      'NavMeshAgentBehavior',
      _('3D Navmesh agent'),
      'NavMeshAgent',
      _('Move this object in 3D on navmesh surfaces using dynamic pathfinding.'),
      '',
      'CppPlatform/Extensions/AStaricon.png',
      'NavMeshAgentBehavior',
      // @ts-ignore
      agentBehavior,
      new gd.BehaviorsSharedData()
    );
    addRuntimeFiles(agent);

    return extension;
  },

  runExtensionSanityTests: function () {
    return [];
  },
};
