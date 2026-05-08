//@ts-check
/// <reference path="../JsExtensionTypes.d.ts" />

/** @type {ExtensionModule} */
module.exports = {
  createExtension: function (_, gd) {
    const extension = new gd.PlatformExtension();
    extension
      .setExtensionInformation(
        'NormalMap2D',
        _('2D Normal Map'),
        _(
          'Add a full 2D normal map behavior for objects. Control per-object lighting values with actions, conditions and expressions.'
        ),
        'Carrots Engine Team',
        'Open source (MIT License)'
      )
      .setShortDescription(
        'Normal map lighting for 2D objects (Sprite, Tiled Sprite, Panel Sprite, Tile Map, external tile maps).'
      )
      .setDimension('2D')
      .setCategory('Visual effect')
      .setTags('normal map, lighting, 2d, shader');
    extension
      .addInstructionOrExpressionGroupMetadata(_('2D Normal Map'))
      .setIcon('res/actions/position24.png');

    const normalMapBehavior = new gd.BehaviorJsImplementation();

    const ensureDefaults = function (behaviorContent) {
      if (!behaviorContent.hasChild('enabled')) {
        behaviorContent.addChild('enabled').setBoolValue(true);
      }
      if (!behaviorContent.hasChild('normalMapResource')) {
        behaviorContent.addChild('normalMapResource').setStringValue('');
      }
      if (!behaviorContent.hasChild('lightAngle')) {
        behaviorContent.addChild('lightAngle').setDoubleValue(315);
      }
      if (!behaviorContent.hasChild('lightElevation')) {
        behaviorContent.addChild('lightElevation').setDoubleValue(45);
      }
      if (!behaviorContent.hasChild('lightIntensity')) {
        behaviorContent.addChild('lightIntensity').setDoubleValue(1);
      }
      if (!behaviorContent.hasChild('ambientIntensity')) {
        behaviorContent.addChild('ambientIntensity').setDoubleValue(0.35);
      }
      if (!behaviorContent.hasChild('normalStrength')) {
        behaviorContent.addChild('normalStrength').setDoubleValue(1);
      }
      if (!behaviorContent.hasChild('specularStrength')) {
        behaviorContent.addChild('specularStrength').setDoubleValue(0.35);
      }
      if (!behaviorContent.hasChild('shininess')) {
        behaviorContent.addChild('shininess').setDoubleValue(24);
      }
      if (!behaviorContent.hasChild('invertY')) {
        behaviorContent.addChild('invertY').setBoolValue(false);
      }
      if (!behaviorContent.hasChild('uvScaleX')) {
        behaviorContent.addChild('uvScaleX').setDoubleValue(1);
      }
      if (!behaviorContent.hasChild('uvScaleY')) {
        behaviorContent.addChild('uvScaleY').setDoubleValue(1);
      }
      if (!behaviorContent.hasChild('uvOffsetX')) {
        behaviorContent.addChild('uvOffsetX').setDoubleValue(0);
      }
      if (!behaviorContent.hasChild('uvOffsetY')) {
        behaviorContent.addChild('uvOffsetY').setDoubleValue(0);
      }
    };

    const parseFiniteNumber = function (value) {
      const parsedValue = parseFloat(value);
      if (!Number.isFinite(parsedValue)) {
        return null;
      }
      return parsedValue;
    };

    const clamp = function (value, min, max) {
      return Math.max(min, Math.min(max, value));
    };

    normalMapBehavior.updateProperty = function (
      behaviorContent,
      propertyName,
      newValue
    ) {
      ensureDefaults(behaviorContent);

      if (propertyName === 'enabled' || propertyName === 'invertY') {
        behaviorContent
          .getChild(propertyName)
          .setBoolValue(newValue === '1' || newValue === 'true');
        return true;
      }

      if (propertyName === 'normalMapResource') {
        behaviorContent.getChild('normalMapResource').setStringValue(newValue);
        return true;
      }

      const parsedValue = parseFiniteNumber(newValue);
      if (parsedValue === null) {
        return false;
      }

      if (propertyName === 'lightAngle') {
        behaviorContent.getChild('lightAngle').setDoubleValue(parsedValue);
        return true;
      }
      if (propertyName === 'lightElevation') {
        behaviorContent
          .getChild('lightElevation')
          .setDoubleValue(clamp(parsedValue, -90, 90));
        return true;
      }
      if (propertyName === 'lightIntensity') {
        behaviorContent
          .getChild('lightIntensity')
          .setDoubleValue(clamp(parsedValue, 0, 8));
        return true;
      }
      if (propertyName === 'ambientIntensity') {
        behaviorContent
          .getChild('ambientIntensity')
          .setDoubleValue(clamp(parsedValue, 0, 4));
        return true;
      }
      if (propertyName === 'normalStrength') {
        behaviorContent
          .getChild('normalStrength')
          .setDoubleValue(clamp(parsedValue, 0, 8));
        return true;
      }
      if (propertyName === 'specularStrength') {
        behaviorContent
          .getChild('specularStrength')
          .setDoubleValue(clamp(parsedValue, 0, 4));
        return true;
      }
      if (propertyName === 'shininess') {
        behaviorContent
          .getChild('shininess')
          .setDoubleValue(clamp(parsedValue, 1, 256));
        return true;
      }
      if (propertyName === 'uvScaleX') {
        behaviorContent
          .getChild('uvScaleX')
          .setDoubleValue(Math.max(0.0001, parsedValue));
        return true;
      }
      if (propertyName === 'uvScaleY') {
        behaviorContent
          .getChild('uvScaleY')
          .setDoubleValue(Math.max(0.0001, parsedValue));
        return true;
      }
      if (propertyName === 'uvOffsetX') {
        behaviorContent.getChild('uvOffsetX').setDoubleValue(parsedValue);
        return true;
      }
      if (propertyName === 'uvOffsetY') {
        behaviorContent.getChild('uvOffsetY').setDoubleValue(parsedValue);
        return true;
      }

      return false;
    };

    normalMapBehavior.getProperties = function (behaviorContent) {
      ensureDefaults(behaviorContent);

      const behaviorProperties = new gd.MapStringPropertyDescriptor();
      behaviorProperties
        .getOrCreate('enabled')
        .setValue(
          behaviorContent.getChild('enabled').getBoolValue() ? 'true' : 'false'
        )
        .setType('Boolean')
        .setLabel(_('Enabled'));
      behaviorProperties
        .getOrCreate('normalMapResource')
        .setValue(behaviorContent.getChild('normalMapResource').getStringValue())
        .setType('resource')
        .addExtraInfo('image')
        .setLabel(_('Normal map image'));
      behaviorProperties
        .getOrCreate('lightAngle')
        .setValue(
          behaviorContent.getChild('lightAngle').getDoubleValue().toString()
        )
        .setType('Number')
        .setLabel(_('Light angle (degrees)'));
      behaviorProperties
        .getOrCreate('lightElevation')
        .setValue(
          behaviorContent.getChild('lightElevation').getDoubleValue().toString()
        )
        .setType('Number')
        .setLabel(_('Light elevation (degrees)'));
      behaviorProperties
        .getOrCreate('lightIntensity')
        .setValue(
          behaviorContent.getChild('lightIntensity').getDoubleValue().toString()
        )
        .setType('Number')
        .setLabel(_('Light intensity'));
      behaviorProperties
        .getOrCreate('ambientIntensity')
        .setValue(
          behaviorContent
            .getChild('ambientIntensity')
            .getDoubleValue()
            .toString()
        )
        .setType('Number')
        .setLabel(_('Ambient intensity'));
      behaviorProperties
        .getOrCreate('normalStrength')
        .setValue(
          behaviorContent
            .getChild('normalStrength')
            .getDoubleValue()
            .toString()
        )
        .setType('Number')
        .setLabel(_('Normal strength'));
      behaviorProperties
        .getOrCreate('specularStrength')
        .setValue(
          behaviorContent
            .getChild('specularStrength')
            .getDoubleValue()
            .toString()
        )
        .setType('Number')
        .setLabel(_('Specular strength'))
        .setGroup(_('Advanced'));
      behaviorProperties
        .getOrCreate('shininess')
        .setValue(
          behaviorContent.getChild('shininess').getDoubleValue().toString()
        )
        .setType('Number')
        .setLabel(_('Shininess'))
        .setGroup(_('Advanced'));
      behaviorProperties
        .getOrCreate('invertY')
        .setValue(
          behaviorContent.getChild('invertY').getBoolValue() ? 'true' : 'false'
        )
        .setType('Boolean')
        .setLabel(_('Invert normal Y'))
        .setGroup(_('Advanced'));
      behaviorProperties
        .getOrCreate('uvScaleX')
        .setValue(
          behaviorContent.getChild('uvScaleX').getDoubleValue().toString()
        )
        .setType('Number')
        .setLabel(_('UV scale X'))
        .setGroup(_('Advanced'));
      behaviorProperties
        .getOrCreate('uvScaleY')
        .setValue(
          behaviorContent.getChild('uvScaleY').getDoubleValue().toString()
        )
        .setType('Number')
        .setLabel(_('UV scale Y'))
        .setGroup(_('Advanced'));
      behaviorProperties
        .getOrCreate('uvOffsetX')
        .setValue(
          behaviorContent.getChild('uvOffsetX').getDoubleValue().toString()
        )
        .setType('Number')
        .setLabel(_('UV offset X'))
        .setGroup(_('Advanced'));
      behaviorProperties
        .getOrCreate('uvOffsetY')
        .setValue(
          behaviorContent.getChild('uvOffsetY').getDoubleValue().toString()
        )
        .setType('Number')
        .setLabel(_('UV offset Y'))
        .setGroup(_('Advanced'));

      return behaviorProperties;
    };

    normalMapBehavior.initializeContent = function (behaviorContent) {
      behaviorContent.addChild('enabled').setBoolValue(true);
      behaviorContent.addChild('normalMapResource').setStringValue('');
      behaviorContent.addChild('lightAngle').setDoubleValue(315);
      behaviorContent.addChild('lightElevation').setDoubleValue(45);
      behaviorContent.addChild('lightIntensity').setDoubleValue(1);
      behaviorContent.addChild('ambientIntensity').setDoubleValue(0.35);
      behaviorContent.addChild('normalStrength').setDoubleValue(1);
      behaviorContent.addChild('specularStrength').setDoubleValue(0.35);
      behaviorContent.addChild('shininess').setDoubleValue(24);
      behaviorContent.addChild('invertY').setBoolValue(false);
      behaviorContent.addChild('uvScaleX').setDoubleValue(1);
      behaviorContent.addChild('uvScaleY').setDoubleValue(1);
      behaviorContent.addChild('uvOffsetX').setDoubleValue(0);
      behaviorContent.addChild('uvOffsetY').setDoubleValue(0);
    };

    const normalMap = extension
      .addBehavior(
        'NormalMapBehavior',
        _('2D Normal Map'),
        'NormalMapBehavior',
        _(
          'Apply normal map lighting to this object. Works with Sprite, Tiled Sprite, Panel Sprite, Tile Map and external tile maps.'
        ),
        '',
        'res/actions/position24.png',
        'NormalMapBehavior',
        // @ts-ignore - BehaviorJsImplementation is valid here.
        normalMapBehavior,
        new gd.BehaviorsSharedData()
      )
      .setIncludeFile('Extensions/NormalMap2D/normalmapruntimebehavior.js');

    normalMap
      .addScopedAction(
        'SetEnabled',
        _('Enable/disable normal map'),
        _('Enable or disable normal map rendering for this object.'),
        _('Set 2D normal map behavior of _PARAM0_ to _PARAM2_'),
        _('Normal Map'),
        'res/actions/position24.png',
        'res/actions/position24.png'
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'NormalMapBehavior')
      .addParameter('yesorno', _('Enabled'))
      .setFunctionName('setEnabled');

    normalMap
      .addScopedAction(
        'DisableNormalMap',
        _('Disable normal map completely'),
        _('Completely disable normal map on this object.'),
        _('Completely disable normal map on _PARAM0_'),
        _('Normal Map'),
        'res/actions/position24.png',
        'res/actions/position24.png'
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'NormalMapBehavior')
      .setFunctionName('disableNormalMap');

    normalMap
      .addScopedCondition(
        'IsEnabled',
        _('Normal map enabled'),
        _('Check if this behavior is enabled.'),
        _('2D normal map behavior is enabled for _PARAM0_'),
        _('Normal Map'),
        'res/actions/position24.png',
        'res/actions/position24.png'
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'NormalMapBehavior')
      .setFunctionName('isEnabled');

    normalMap
      .addScopedAction(
        'SetNormalMapResource',
        _('Set normal map image'),
        _('Set the normal map image resource used by this object.'),
        _('Set normal map image of _PARAM0_ to _PARAM2_'),
        _('Normal Map'),
        'res/actions/position24.png',
        'res/actions/position24.png'
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'NormalMapBehavior')
      .addParameter('string', _('Normal map image resource name'), '', false)
      .setFunctionName('setNormalMapResource');

    normalMap
      .addScopedCondition(
        'HasValidNormalMap',
        _('Has valid normal map image'),
        _(
          'Check if the normal map image is valid and loaded (not missing placeholder texture).'
        ),
        _('_PARAM0_ has a valid normal map image'),
        _('Normal Map'),
        'res/actions/position24.png',
        'res/actions/position24.png'
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'NormalMapBehavior')
      .setFunctionName('hasValidNormalMap');

    normalMap
      .addStrExpression(
        'NormalMapResource',
        _('Normal map image resource'),
        _('the normal map image resource name'),
        _('Normal Map'),
        'res/actions/position24.png'
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'NormalMapBehavior')
      .setFunctionName('getNormalMapResource');

    normalMap
      .addScopedAction(
        'SetInvertY',
        _('Invert normal Y'),
        _('Invert (or not) the Y channel of sampled normal map.'),
        _('Set invert normal Y of _PARAM0_ to _PARAM2_'),
        _('Normal Map'),
        'res/actions/position24.png',
        'res/actions/position24.png'
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'NormalMapBehavior')
      .addParameter('yesorno', _('Invert Y'))
      .setFunctionName('setInvertY');

    normalMap
      .addScopedCondition(
        'IsInvertY',
        _('Normal Y is inverted'),
        _('Check if normal map Y channel is inverted.'),
        _('Invert normal Y is enabled for _PARAM0_'),
        _('Normal Map'),
        'res/actions/position24.png',
        'res/actions/position24.png'
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'NormalMapBehavior')
      .setFunctionName('isInvertY');

    const addNumberParameter = function (
      instructionName,
      fullName,
      shortDescription,
      sentenceName,
      parameterDescription,
      functionName,
      getterName
    ) {
      normalMap
        .addExpressionAndConditionAndAction(
          'number',
          instructionName,
          fullName,
          shortDescription,
          sentenceName,
          _('Normal Map'),
          'res/actions/position24.png'
        )
        .addParameter('object', _('Object'), '', false)
        .addParameter('behavior', _('Behavior'), 'NormalMapBehavior')
        .useStandardParameters(
          'number',
          gd.ParameterOptions.makeNewOptions().setDescription(
            _(parameterDescription)
          )
        )
        .setFunctionName(functionName)
        .setGetter(getterName);
    };

    addNumberParameter(
      'LightAngle',
      _('Light angle'),
      _('the horizontal light angle in degrees'),
      _('the light angle (degrees)'),
      'Horizontal light angle in degrees',
      'setLightAngle',
      'getLightAngle'
    );
    addNumberParameter(
      'LightElevation',
      _('Light elevation'),
      _('the light elevation in degrees'),
      _('the light elevation (degrees)'),
      'Light elevation in degrees',
      'setLightElevation',
      'getLightElevation'
    );
    addNumberParameter(
      'LightIntensity',
      _('Light intensity'),
      _('the light intensity'),
      _('the light intensity'),
      'Light intensity',
      'setLightIntensity',
      'getLightIntensity'
    );
    addNumberParameter(
      'AmbientIntensity',
      _('Ambient intensity'),
      _('the ambient light intensity'),
      _('the ambient intensity'),
      'Ambient light intensity',
      'setAmbientIntensity',
      'getAmbientIntensity'
    );
    addNumberParameter(
      'NormalStrength',
      _('Normal strength'),
      _('the normal map strength'),
      _('the normal strength'),
      'Normal map strength',
      'setNormalStrength',
      'getNormalStrength'
    );
    addNumberParameter(
      'SpecularStrength',
      _('Specular strength'),
      _('the specular light strength'),
      _('the specular strength'),
      'Specular strength',
      'setSpecularStrength',
      'getSpecularStrength'
    );
    addNumberParameter(
      'Shininess',
      _('Shininess'),
      _('the shininess value'),
      _('the shininess'),
      'Shininess value',
      'setShininess',
      'getShininess'
    );
    addNumberParameter(
      'UVScaleX',
      _('UV scale X'),
      _('the normal map UV scale on X'),
      _('the UV scale X'),
      'Normal map UV scale on X',
      'setUVScaleX',
      'getUVScaleX'
    );
    addNumberParameter(
      'UVScaleY',
      _('UV scale Y'),
      _('the normal map UV scale on Y'),
      _('the UV scale Y'),
      'Normal map UV scale on Y',
      'setUVScaleY',
      'getUVScaleY'
    );
    addNumberParameter(
      'UVOffsetX',
      _('UV offset X'),
      _('the normal map UV offset on X'),
      _('the UV offset X'),
      'Normal map UV offset on X',
      'setUVOffsetX',
      'getUVOffsetX'
    );
    addNumberParameter(
      'UVOffsetY',
      _('UV offset Y'),
      _('the normal map UV offset on Y'),
      _('the UV offset Y'),
      'Normal map UV offset on Y',
      'setUVOffsetY',
      'getUVOffsetY'
    );

    return extension;
  },

  runExtensionSanityTests: function (gd, extension) {
    const behavior = extension
      .getBehaviorMetadata('NormalMap2D::NormalMapBehavior')
      .get();
    return [
      gd.ProjectHelper.sanityCheckBehaviorProperty(behavior, 'enabled', 'true'),
      gd.ProjectHelper.sanityCheckBehaviorProperty(
        behavior,
        'normalMapResource',
        'AnyImageResource'
      ),
      gd.ProjectHelper.sanityCheckBehaviorProperty(
        behavior,
        'lightAngle',
        '180'
      ),
      gd.ProjectHelper.sanityCheckBehaviorProperty(
        behavior,
        'lightElevation',
        '25'
      ),
      gd.ProjectHelper.sanityCheckBehaviorProperty(
        behavior,
        'ambientIntensity',
        '0.4'
      ),
      gd.ProjectHelper.sanityCheckBehaviorProperty(
        behavior,
        'invertY',
        'true'
      ),
      gd.ProjectHelper.sanityCheckBehaviorProperty(
        behavior,
        'uvScaleX',
        '2.5'
      ),
    ];
  },
};
