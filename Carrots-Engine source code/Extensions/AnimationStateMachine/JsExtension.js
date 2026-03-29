//@ts-check
/// <reference path="../JsExtensionTypes.d.ts" />

const createDefaultGraphDefinition = () =>
  JSON.stringify(
    {
      version: 1,
      defaultStateId: 'idle',
      states: [
        {
          id: 'idle',
          name: 'idle',
          animationName: 'idle',
          x: 220,
          y: 260,
        },
        {
          id: 'run',
          name: 'run',
          animationName: 'run',
          x: 620,
          y: 260,
        },
      ],
      transitions: [
        {
          id: 'idle-to-run',
          fromStateId: 'idle',
          toStateId: 'run',
          mode: 'number',
          parameter: 'speed',
          comparison: '>',
          numberValue: 0.1,
          minDuration: 0,
        },
        {
          id: 'run-to-idle',
          fromStateId: 'run',
          toStateId: 'idle',
          mode: 'number',
          parameter: 'speed',
          comparison: '<=',
          numberValue: 0.1,
          minDuration: 0,
        },
      ],
    },
    null,
    2
  );

/** @type {ExtensionModule} */
module.exports = {
  createExtension: function (_, gd) {
    const extension = new gd.PlatformExtension();
    extension
      .setExtensionInformation(
        'AnimationStateMachine',
        _('Animation State Machine'),
        _(
          'Visual state machine for animation flow. Supports 2D and 3D animatable objects with graph states and transitions.'
        ),
        'Carrots Engine',
        'MIT'
      )
      .setCategory('Animation')
      .setShortDescription(
        'Create professional animation state graphs with states, transitions, triggers and parameters.'
      );

    extension
      .addInstructionOrExpressionGroupMetadata(_('Animation State Machine'))
      .setIcon('res/actions/animation24.png');

    const behavior = new gd.BehaviorJsImplementation();

    const ensureDefaults = behaviorContent => {
      if (!behaviorContent.hasChild('enabled')) {
        behaviorContent.addChild('enabled').setBoolValue(true);
      }
      if (!behaviorContent.hasChild('autoApplyAnimation')) {
        behaviorContent.addChild('autoApplyAnimation').setBoolValue(true);
      }
      if (!behaviorContent.hasChild('defaultState')) {
        behaviorContent.addChild('defaultState').setStringValue('idle');
      }
      if (!behaviorContent.hasChild('graphDefinition')) {
        behaviorContent
          .addChild('graphDefinition')
          .setStringValue(createDefaultGraphDefinition());
      }
    };

    behavior.updateProperty = function (behaviorContent, propertyName, newValue) {
      ensureDefaults(behaviorContent);

      if (propertyName === 'enabled') {
        behaviorContent
          .getChild('enabled')
          .setBoolValue(newValue === '1' || newValue === 'true');
        return true;
      }
      if (propertyName === 'autoApplyAnimation') {
        behaviorContent
          .getChild('autoApplyAnimation')
          .setBoolValue(newValue === '1' || newValue === 'true');
        return true;
      }
      if (propertyName === 'defaultState') {
        behaviorContent.getChild('defaultState').setStringValue(String(newValue || ''));
        return true;
      }
      if (propertyName === 'graphDefinition') {
        behaviorContent
          .getChild('graphDefinition')
          .setStringValue(String(newValue || createDefaultGraphDefinition()));
        return true;
      }

      return false;
    };

    behavior.getProperties = function (behaviorContent) {
      ensureDefaults(behaviorContent);
      const behaviorProperties = new gd.MapStringPropertyDescriptor();

      behaviorProperties
        .getOrCreate('enabled')
        .setValue(behaviorContent.getChild('enabled').getBoolValue() ? 'true' : 'false')
        .setType('Boolean')
        .setLabel(_('Enabled'));

      behaviorProperties
        .getOrCreate('autoApplyAnimation')
        .setValue(
          behaviorContent.getChild('autoApplyAnimation').getBoolValue()
            ? 'true'
            : 'false'
        )
        .setType('Boolean')
        .setLabel(_('Apply animation automatically'));

      behaviorProperties
        .getOrCreate('defaultState')
        .setValue(behaviorContent.getChild('defaultState').getStringValue())
        .setType('string')
        .setLabel(_('Default state'));

      behaviorProperties
        .getOrCreate('graphDefinition')
        .setValue(behaviorContent.getChild('graphDefinition').getStringValue())
        .setType('string')
        .setLabel(_('Graph definition JSON'));

      return behaviorProperties;
    };

    behavior.initializeContent = function (behaviorContent) {
      behaviorContent.addChild('enabled').setBoolValue(true);
      behaviorContent.addChild('autoApplyAnimation').setBoolValue(true);
      behaviorContent.addChild('defaultState').setStringValue('idle');
      behaviorContent
        .addChild('graphDefinition')
        .setStringValue(createDefaultGraphDefinition());
    };

    const controllerBehavior = extension
      .addBehavior(
        'StateMachine',
        _('Animation state machine'),
        'StateMachine',
        _(
          'Control object animation with a visual state graph (2D and 3D). States map to animation names and transitions can use triggers and parameters.'
        ),
        '',
        'res/actions/animation24.png',
        'StateMachine',
        // @ts-ignore
        behavior,
        new gd.BehaviorsSharedData()
      )
      .setIncludeFile(
        'Extensions/AnimationStateMachine/AnimationStateMachineRuntimeBehavior.js'
      );

    controllerBehavior
      .addScopedAction(
        'SetEnabled',
        _('Enable/disable state machine'),
        _('Enable or disable this animation state machine behavior.'),
        _('Set animation state machine of _PARAM0_ to _PARAM2_'),
        _('State machine'),
        'res/actions/animation24.png',
        'res/actions/animation.png'
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'StateMachine')
      .addParameter('yesorno', _('Enabled'))
      .setFunctionName('setEnabled');

    controllerBehavior
      .addScopedAction(
        'SetState',
        _('Set current state'),
        _('Switch immediately to a state by name or id.'),
        _('Set state of _PARAM0_ to _PARAM2_'),
        _('State machine'),
        'res/actions/animation24.png',
        'res/actions/animation.png'
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'StateMachine')
      .addParameter('string', _('State id or name'), '', false)
      .setFunctionName('setState');

    controllerBehavior
      .addScopedAction(
        'SetDefaultState',
        _('Set default state'),
        _('Change the default state used when the graph starts or reloads.'),
        _('Set default state of _PARAM0_ to _PARAM2_'),
        _('State machine'),
        'res/actions/animation24.png',
        'res/actions/animation.png'
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'StateMachine')
      .addParameter('string', _('State id or name'), '', false)
      .setFunctionName('setDefaultState');

    controllerBehavior
      .addScopedAction(
        'Trigger',
        _('Trigger transition'),
        _('Set a trigger that can be consumed by transitions.'),
        _('Trigger _PARAM2_ on _PARAM0_'),
        _('State machine'),
        'res/actions/animation24.png',
        'res/actions/animation.png'
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'StateMachine')
      .addParameter('string', _('Trigger name'), '', false)
      .setFunctionName('trigger');

    controllerBehavior
      .addScopedAction(
        'SetNumberParameter',
        _('Set number parameter'),
        _('Set a numeric parameter used by transitions.'),
        _('Set parameter _PARAM2_ of _PARAM0_ to _PARAM3_'),
        _('State machine'),
        'res/actions/time24.png',
        'res/actions/time.png'
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'StateMachine')
      .addParameter('string', _('Parameter name'), '', false)
      .addParameter('number', _('Value'), '', false)
      .setFunctionName('setNumberParameter');

    controllerBehavior
      .addScopedAction(
        'SetBooleanParameter',
        _('Set boolean parameter'),
        _('Set a boolean parameter used by transitions.'),
        _('Set parameter _PARAM2_ of _PARAM0_ to _PARAM3_'),
        _('State machine'),
        'res/actions/animation24.png',
        'res/actions/animation.png'
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'StateMachine')
      .addParameter('string', _('Parameter name'), '', false)
      .addParameter('yesorno', _('Value'), '', false)
      .setFunctionName('setBooleanParameter');

    controllerBehavior
      .addScopedAction(
        'ReloadDefinition',
        _('Reload graph definition'),
        _(
          'Reload and reparse the graph definition from the behavior properties.'
        ),
        _('Reload state machine graph for _PARAM0_'),
        _('State machine'),
        'res/actions/animation24.png',
        'res/actions/animation.png'
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'StateMachine')
      .setFunctionName('reloadDefinition');

    controllerBehavior
      .addScopedCondition(
        'IsEnabled',
        _('State machine enabled'),
        _('Check if the state machine behavior is enabled.'),
        _('State machine of _PARAM0_ is enabled'),
        _('State machine'),
        'res/actions/animation24.png',
        'res/actions/animation.png'
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'StateMachine')
      .setFunctionName('isEnabled');

    controllerBehavior
      .addScopedCondition(
        'IsInState',
        _('Is in state'),
        _('Check if the object is currently in the given state.'),
        _('State of _PARAM0_ is _PARAM2_'),
        _('State machine'),
        'res/actions/animation24.png',
        'res/actions/animation.png'
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'StateMachine')
      .addParameter('string', _('State id or name'), '', false)
      .setFunctionName('isInState');

    controllerBehavior
      .addScopedCondition(
        'HasState',
        _('State exists'),
        _('Check if the graph contains a state with the given id or name.'),
        _('State machine of _PARAM0_ has state _PARAM2_'),
        _('State machine'),
        'res/actions/animation24.png',
        'res/actions/animation.png'
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'StateMachine')
      .addParameter('string', _('State id or name'), '', false)
      .setFunctionName('hasState');

    controllerBehavior
      .addScopedCondition(
        'BooleanParameterIsTrue',
        _('Boolean parameter is true'),
        _('Check if a boolean state machine parameter is true.'),
        _('Boolean parameter _PARAM2_ of _PARAM0_ is true'),
        _('State machine'),
        'res/actions/animation24.png',
        'res/actions/animation.png'
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'StateMachine')
      .addParameter('string', _('Parameter name'), '', false)
      .setFunctionName('getBooleanParameter');

    controllerBehavior
      .addStrExpression(
        'CurrentState',
        _('Current state'),
        _('State machine'),
        _('Current animation state'),
        _('Get current state id of the animation state machine.')
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'StateMachine')
      .setFunctionName('getCurrentState');

    controllerBehavior
      .addStrExpression(
        'CurrentStateName',
        _('Current state name'),
        _('State machine'),
        _('Current animation state name'),
        _('Get current state display name of the animation state machine.')
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'StateMachine')
      .setFunctionName('getCurrentStateName');

    controllerBehavior
      .addStrExpression(
        'CurrentAnimation',
        _('Current animation'),
        _('State machine'),
        _('Current animation name'),
        _('Get current animation name resolved by the animation state machine.')
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'StateMachine')
      .setFunctionName('getCurrentAnimationName');

    controllerBehavior
      .addStrExpression(
        'DefaultState',
        _('Default state'),
        _('State machine'),
        _('Default state'),
        _('Get the current default state id of the animation state machine.')
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'StateMachine')
      .setFunctionName('getDefaultState');

    controllerBehavior
      .addExpression(
        'NumberParameter',
        _('Number parameter'),
        _('State machine'),
        _('Get number parameter'),
        _('Get a numeric parameter used by the animation state machine.')
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'StateMachine')
      .addParameter('string', _('Parameter name'), '', false)
      .setFunctionName('getNumberParameter');

    return extension;
  },
  runExtensionSanityTests: function () {
    return [];
  },
};
