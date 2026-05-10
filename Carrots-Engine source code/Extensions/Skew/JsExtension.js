//@ts-check
/// <reference path="../JsExtensionTypes.d.ts" />

/** @type {ExtensionModule} */
module.exports = {
  createExtension: function (_, gd) {
    const skewIconPath = 'JsPlatform/Extensions/skew.svg';
    const skewActionIcon24 = 'res/actions/rotate24_black.png';
    const skewActionIcon = 'res/actions/rotate_black.png';

    const extension = new gd.PlatformExtension();
    extension
      .setExtensionInformation(
        'Skew',
        _('2D Skew'),
        _(
          'Add a complete runtime skew system for 2D objects. Includes safe limits, frame-rate independent smoothing and procedural wind sway.'
        ),
        'Carrots Engine Team',
        'Open source (MIT License)'
      )
      .setShortDescription(
        'Skew 2D objects on X/Y axis with stable smoothing and wind sway controls.'
      )
      .setDimension('2D')
      .setCategory('Visual effect')
      .setTags('skew, transform, 2d, smooth, wind');
    extension
      .addInstructionOrExpressionGroupMetadata(_('2D Skew'))
      .setIcon(skewIconPath);

    const skewBehavior = new gd.BehaviorJsImplementation();

    const numberPropertyDefaults = {
      skewX: 0,
      skewY: 0,
      maxAbsoluteSkewDegrees: 85,
      smoothingResponsiveness: 0,
      windAmplitudeX: 0,
      windAmplitudeY: 0,
      windFrequency: 0.8,
      windTurbulence: 0.35,
    };

    const ensureDefaults = function (behaviorContent) {
      if (!behaviorContent.hasChild('enabled')) {
        behaviorContent.addChild('enabled').setBoolValue(true);
      }
      if (!behaviorContent.hasChild('windEnabled')) {
        behaviorContent.addChild('windEnabled').setBoolValue(false);
      }
      Object.keys(numberPropertyDefaults).forEach(propertyName => {
        if (!behaviorContent.hasChild(propertyName)) {
          behaviorContent
            .addChild(propertyName)
            .setDoubleValue(numberPropertyDefaults[propertyName]);
        }
      });
    };

    const parseFiniteNumber = function (value) {
      const parsedValue = parseFloat(value);
      if (!Number.isFinite(parsedValue)) {
        return null;
      }
      return parsedValue;
    };

    skewBehavior.updateProperty = function (
      behaviorContent,
      propertyName,
      newValue
    ) {
      ensureDefaults(behaviorContent);

      if (propertyName === 'enabled' || propertyName === 'windEnabled') {
        behaviorContent
          .getChild(propertyName)
          .setBoolValue(newValue === '1' || newValue === 'true');
        return true;
      }

      if (Object.prototype.hasOwnProperty.call(numberPropertyDefaults, propertyName)) {
        const parsedValue = parseFiniteNumber(newValue);
        if (parsedValue === null) {
          return false;
        }
        behaviorContent.getChild(propertyName).setDoubleValue(parsedValue);
        return true;
      }

      return false;
    };

    skewBehavior.getProperties = function (behaviorContent) {
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
        .getOrCreate('skewX')
        .setValue(behaviorContent.getChild('skewX').getDoubleValue().toString())
        .setType('Number')
        .setLabel(_('Skew X (degrees)'));
      behaviorProperties
        .getOrCreate('skewY')
        .setValue(behaviorContent.getChild('skewY').getDoubleValue().toString())
        .setType('Number')
        .setLabel(_('Skew Y (degrees)'));
      behaviorProperties
        .getOrCreate('maxAbsoluteSkewDegrees')
        .setValue(
          behaviorContent
            .getChild('maxAbsoluteSkewDegrees')
            .getDoubleValue()
            .toString()
        )
        .setType('Number')
        .setLabel(_('Max absolute skew (degrees)'));
      behaviorProperties
        .getOrCreate('smoothingResponsiveness')
        .setValue(
          behaviorContent
            .getChild('smoothingResponsiveness')
            .getDoubleValue()
            .toString()
        )
        .setType('Number')
        .setLabel(_('Smoothing responsiveness (per second)'));
      behaviorProperties
        .getOrCreate('windEnabled')
        .setValue(
          behaviorContent.getChild('windEnabled').getBoolValue()
            ? 'true'
            : 'false'
        )
        .setType('Boolean')
        .setLabel(_('Wind sway enabled'));
      behaviorProperties
        .getOrCreate('windAmplitudeX')
        .setValue(
          behaviorContent
            .getChild('windAmplitudeX')
            .getDoubleValue()
            .toString()
        )
        .setType('Number')
        .setLabel(_('Wind amplitude X (degrees)'));
      behaviorProperties
        .getOrCreate('windAmplitudeY')
        .setValue(
          behaviorContent
            .getChild('windAmplitudeY')
            .getDoubleValue()
            .toString()
        )
        .setType('Number')
        .setLabel(_('Wind amplitude Y (degrees)'));
      behaviorProperties
        .getOrCreate('windFrequency')
        .setValue(
          behaviorContent
            .getChild('windFrequency')
            .getDoubleValue()
            .toString()
        )
        .setType('Number')
        .setLabel(_('Wind frequency (cycles per second)'));
      behaviorProperties
        .getOrCreate('windTurbulence')
        .setValue(
          behaviorContent
            .getChild('windTurbulence')
            .getDoubleValue()
            .toString()
        )
        .setType('Number')
        .setLabel(_('Wind turbulence (0 to 1)'));

      return behaviorProperties;
    };

    skewBehavior.initializeContent = function (behaviorContent) {
      behaviorContent.addChild('enabled').setBoolValue(true);
      behaviorContent.addChild('windEnabled').setBoolValue(false);
      Object.keys(numberPropertyDefaults).forEach(propertyName => {
        behaviorContent
          .addChild(propertyName)
          .setDoubleValue(numberPropertyDefaults[propertyName]);
      });
    };

    const skew = extension
      .addBehavior(
        'SkewBehavior',
        _('2D Skew'),
        'SkewBehavior',
        _(
          'Apply skew to any 2D object renderer. Values are in degrees, clamped to a safe range and can be smoothed over time.'
        ),
        '',
        skewActionIcon24,
        'SkewBehavior',
        // @ts-ignore - BehaviorJsImplementation is valid here.
        skewBehavior,
        new gd.BehaviorsSharedData()
      )
      .setIncludeFile('Extensions/Skew/skewruntimebehavior.js');

    skew
      .addScopedAction(
        'SetEnabled',
        _('Enable/disable skew'),
        _('Enable or disable skew updates for this object.'),
        _('Set 2D skew behavior of _PARAM0_ to _PARAM2_'),
        _('Skew'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .addParameter('yesorno', _('Enabled'))
      .setFunctionName('setEnabled');

    skew
      .addScopedCondition(
        'IsEnabled',
        _('Skew enabled'),
        _('Check if this behavior is enabled.'),
        _('2D skew behavior is enabled for _PARAM0_'),
        _('Skew'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .setFunctionName('isEnabled');

    skew
      .addExpressionAndConditionAndAction(
        'number',
        'SkewX',
        _('Skew X'),
        _('the skew on X axis'),
        _('the skew on X axis (degrees)'),
        _('Skew'),
        skewActionIcon24
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .useStandardParameters(
        'number',
        gd.ParameterOptions.makeNewOptions().setDescription(
          _('Skew X in degrees')
        )
      )
      .setFunctionName('setSkewX')
      .setGetter('getSkewX');

    skew
      .addExpressionAndConditionAndAction(
        'number',
        'SkewY',
        _('Skew Y'),
        _('the skew on Y axis'),
        _('the skew on Y axis (degrees)'),
        _('Skew'),
        skewActionIcon24
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .useStandardParameters(
        'number',
        gd.ParameterOptions.makeNewOptions().setDescription(
          _('Skew Y in degrees')
        )
      )
      .setFunctionName('setSkewY')
      .setGetter('getSkewY');

    skew
      .addScopedAction(
        'AddSkewX',
        _('Add skew X'),
        _('Add to the skew on X axis.'),
        _('Add _PARAM2_ deg skew X to _PARAM0_'),
        _('Skew'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .addParameter('number', _('Skew X to add (degrees)'), '', false)
      .setFunctionName('addSkewX');

    skew
      .addScopedAction(
        'AddSkewY',
        _('Add skew Y'),
        _('Add to the skew on Y axis.'),
        _('Add _PARAM2_ deg skew Y to _PARAM0_'),
        _('Skew'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .addParameter('number', _('Skew Y to add (degrees)'), '', false)
      .setFunctionName('addSkewY');

    skew
      .addScopedAction(
        'InterpolateSkewX',
        _('Interpolate skew X'),
        _(
          'Interpolate skew X toward a target value with a clamped factor (0 to 1).'
        ),
        _(
          'Interpolate skew X of _PARAM0_ toward _PARAM2_ deg with factor _PARAM3_'
        ),
        _('Skew'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .addParameter('number', _('Target skew X (degrees)'), '', false)
      .addParameter(
        'number',
        _('Interpolation factor (0 to 1, clamped)'),
        '',
        false
      )
      .setFunctionName('interpolateSkewX');

    skew
      .addScopedAction(
        'InterpolateSkewY',
        _('Interpolate skew Y'),
        _(
          'Interpolate skew Y toward a target value with a clamped factor (0 to 1).'
        ),
        _(
          'Interpolate skew Y of _PARAM0_ toward _PARAM2_ deg with factor _PARAM3_'
        ),
        _('Skew'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .addParameter('number', _('Target skew Y (degrees)'), '', false)
      .addParameter(
        'number',
        _('Interpolation factor (0 to 1, clamped)'),
        '',
        false
      )
      .setFunctionName('interpolateSkewY');

    skew
      .addScopedAction(
        'InterpolateSkewXY',
        _('Interpolate skew X and Y'),
        _(
          'Interpolate skew on both axes toward target values with a clamped factor (0 to 1).'
        ),
        _(
          'Interpolate skew of _PARAM0_ toward X: _PARAM2_ deg and Y: _PARAM3_ deg with factor _PARAM4_'
        ),
        _('Skew'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .addParameter('number', _('Target skew X (degrees)'), '', false)
      .addParameter('number', _('Target skew Y (degrees)'), '', false)
      .addParameter(
        'number',
        _('Interpolation factor (0 to 1, clamped)'),
        '',
        false
      )
      .setFunctionName('interpolateSkew');

    skew
      .addScopedAction(
        'InterpolateSkewXBySpeed',
        _('Smooth skew X by speed'),
        _(
          'Smooth skew X toward a target using frame-rate independent responsiveness (per second).'
        ),
        _(
          'Smooth skew X of _PARAM0_ toward _PARAM2_ deg at responsiveness _PARAM3_'
        ),
        _('Smoothing'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .addParameter('number', _('Target skew X (degrees)'), '', false)
      .addParameter('number', _('Responsiveness (per second)'), '', false)
      .setFunctionName('interpolateSkewXBySpeed');

    skew
      .addScopedAction(
        'InterpolateSkewYBySpeed',
        _('Smooth skew Y by speed'),
        _(
          'Smooth skew Y toward a target using frame-rate independent responsiveness (per second).'
        ),
        _(
          'Smooth skew Y of _PARAM0_ toward _PARAM2_ deg at responsiveness _PARAM3_'
        ),
        _('Smoothing'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .addParameter('number', _('Target skew Y (degrees)'), '', false)
      .addParameter('number', _('Responsiveness (per second)'), '', false)
      .setFunctionName('interpolateSkewYBySpeed');

    skew
      .addScopedAction(
        'InterpolateSkewBySpeed',
        _('Smooth skew X and Y by speed'),
        _(
          'Smooth skew on both axes using frame-rate independent responsiveness (per second).'
        ),
        _(
          'Smooth skew of _PARAM0_ toward X: _PARAM2_ deg and Y: _PARAM3_ deg at responsiveness _PARAM4_'
        ),
        _('Smoothing'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .addParameter('number', _('Target skew X (degrees)'), '', false)
      .addParameter('number', _('Target skew Y (degrees)'), '', false)
      .addParameter('number', _('Responsiveness (per second)'), '', false)
      .setFunctionName('interpolateSkewBySpeed');

    skew
      .addExpressionAndConditionAndAction(
        'number',
        'SmoothingResponsiveness',
        _('Smoothing responsiveness'),
        _('the smoothing responsiveness in updates per second'),
        _('the smoothing responsiveness in updates per second'),
        _('Smoothing'),
        skewActionIcon24
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .useStandardParameters(
        'number',
        gd.ParameterOptions.makeNewOptions().setDescription(
          _('Responsiveness (per second). 0 disables automatic smoothing.')
        )
      )
      .setFunctionName('setSmoothingResponsiveness')
      .setGetter('getSmoothingResponsiveness');

    skew
      .addExpressionAndConditionAndAction(
        'number',
        'MaxAbsoluteSkewDegrees',
        _('Max absolute skew'),
        _('the maximum absolute skew in degrees'),
        _('the maximum absolute skew in degrees'),
        _('Smoothing'),
        skewActionIcon24
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .useStandardParameters(
        'number',
        gd.ParameterOptions.makeNewOptions().setDescription(
          _('Maximum absolute skew in degrees. Clamped internally for stability.')
        )
      )
      .setFunctionName('setMaxAbsoluteSkewDegrees')
      .setGetter('getMaxAbsoluteSkewDegrees');

    skew
      .addScopedAction(
        'SetWindEnabled',
        _('Enable/disable wind sway'),
        _('Enable or disable procedural wind sway on skew.'),
        _('Set wind sway of _PARAM0_ to _PARAM2_'),
        _('Wind sway'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .addParameter('yesorno', _('Enabled'))
      .setFunctionName('setWindEnabled');

    skew
      .addScopedCondition(
        'IsWindEnabled',
        _('Wind sway enabled'),
        _('Check if procedural wind sway is enabled.'),
        _('Wind sway is enabled for _PARAM0_'),
        _('Wind sway'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .setFunctionName('isWindEnabled');

    skew
      .addExpressionAndConditionAndAction(
        'number',
        'WindAmplitudeX',
        _('Wind amplitude X'),
        _('the wind sway amplitude on X axis'),
        _('the wind sway amplitude on X axis (degrees)'),
        _('Wind sway'),
        skewActionIcon24
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .useStandardParameters(
        'number',
        gd.ParameterOptions.makeNewOptions().setDescription(
          _('Wind sway amplitude on X axis in degrees')
        )
      )
      .setFunctionName('setWindAmplitudeX')
      .setGetter('getWindAmplitudeX');

    skew
      .addExpressionAndConditionAndAction(
        'number',
        'WindAmplitudeY',
        _('Wind amplitude Y'),
        _('the wind sway amplitude on Y axis'),
        _('the wind sway amplitude on Y axis (degrees)'),
        _('Wind sway'),
        skewActionIcon24
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .useStandardParameters(
        'number',
        gd.ParameterOptions.makeNewOptions().setDescription(
          _('Wind sway amplitude on Y axis in degrees')
        )
      )
      .setFunctionName('setWindAmplitudeY')
      .setGetter('getWindAmplitudeY');

    skew
      .addExpressionAndConditionAndAction(
        'number',
        'WindFrequency',
        _('Wind frequency'),
        _('the wind sway frequency'),
        _('the wind sway frequency (cycles per second)'),
        _('Wind sway'),
        skewActionIcon24
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .useStandardParameters(
        'number',
        gd.ParameterOptions.makeNewOptions().setDescription(
          _('Wind sway cycles per second')
        )
      )
      .setFunctionName('setWindFrequency')
      .setGetter('getWindFrequency');

    skew
      .addExpressionAndConditionAndAction(
        'number',
        'WindTurbulence',
        _('Wind turbulence'),
        _('the wind sway turbulence'),
        _('the wind sway turbulence (0 to 1)'),
        _('Wind sway'),
        skewActionIcon24
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .useStandardParameters(
        'number',
        gd.ParameterOptions.makeNewOptions().setDescription(
          _('Wind turbulence between 0 (smooth) and 1 (gusty)')
        )
      )
      .setFunctionName('setWindTurbulence')
      .setGetter('getWindTurbulence');

    skew
      .addScopedAction(
        'ResetWindTime',
        _('Reset wind phase'),
        _('Reset wind internal phase/seed for this object.'),
        _('Reset wind phase of _PARAM0_'),
        _('Wind sway'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .setFunctionName('resetWindTime');

    skew
      .addScopedAction(
        'SetSkewXY',
        _('Set skew X and Y'),
        _('Set skew on both axes at once.'),
        _('Set skew of _PARAM0_ to X: _PARAM2_ deg and Y: _PARAM3_ deg'),
        _('Skew'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .addParameter('number', _('Skew X (degrees)'), '', false)
      .addParameter('number', _('Skew Y (degrees)'), '', false)
      .setFunctionName('setSkew');

    skew
      .addScopedAction(
        'ResetSkew',
        _('Reset skew'),
        _('Reset skew values to 0 on both axes.'),
        _('Reset skew of _PARAM0_'),
        _('Skew'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .setFunctionName('resetSkew');

    return extension;
  },

  runExtensionSanityTests: function (gd, extension) {
    const behavior = extension.getBehaviorMetadata('Skew::SkewBehavior').get();
    return [
      gd.ProjectHelper.sanityCheckBehaviorProperty(behavior, 'enabled', 'true'),
      gd.ProjectHelper.sanityCheckBehaviorProperty(behavior, 'skewX', '12.5'),
      gd.ProjectHelper.sanityCheckBehaviorProperty(behavior, 'skewY', '-8.25'),
      gd.ProjectHelper.sanityCheckBehaviorProperty(
        behavior,
        'maxAbsoluteSkewDegrees',
        '80'
      ),
      gd.ProjectHelper.sanityCheckBehaviorProperty(
        behavior,
        'smoothingResponsiveness',
        '12'
      ),
      gd.ProjectHelper.sanityCheckBehaviorProperty(
        behavior,
        'windEnabled',
        'true'
      ),
      gd.ProjectHelper.sanityCheckBehaviorProperty(
        behavior,
        'windAmplitudeX',
        '4.5'
      ),
      gd.ProjectHelper.sanityCheckBehaviorProperty(
        behavior,
        'windAmplitudeY',
        '2.75'
      ),
      gd.ProjectHelper.sanityCheckBehaviorProperty(
        behavior,
        'windFrequency',
        '1.2'
      ),
      gd.ProjectHelper.sanityCheckBehaviorProperty(
        behavior,
        'windTurbulence',
        '0.5'
      ),
    ];
  },
};
