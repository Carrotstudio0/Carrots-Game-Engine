//@ts-check
/// <reference path="../JsExtensionTypes.d.ts" />

/** @type {ExtensionModule} */
module.exports = {
  createExtension: function (_, gd) {
    const extension = new gd.PlatformExtension();
    extension
      .setExtensionInformation(
        'CinematicTimeline',
        _('Cinematic Timeline'),
        _(
          'Play cinematic timeline scenes from events. Useful for cutscenes, scripted camera moves and 3D animation playback.'
        ),
        'Carrots Engine',
        'MIT'
      )
      .setCategory('Animation')
      .setShortDescription(
        'Load, play and control cinematic timeline JSON from events.'
      );

    extension
      .addInstructionOrExpressionGroupMetadata(_('Cinematic Timeline'))
      .setIcon('res/actions/animation24.png');

    extension
      .addAction(
        'LoadFromJson',
        _('Load cinematic JSON'),
        _(
          'Load a cinematic timeline JSON (runtime format) that was exported from the timeline editor.'
        ),
        _('Load cinematic timeline from JSON: _PARAM1_'),
        _('Cinematic Timeline'),
        'res/actions/animation24.png',
        'res/actions/animation.png'
      )
      .addCodeOnlyParameter('currentScene', '')
      .addParameter('string', _('JSON string'), '', false)
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.loadFromJson');

    extension
      .addAction(
        'Play',
        _('Play cinematic'),
        _('Play the loaded cinematic timeline.'),
        _('Play cinematic timeline'),
        _('Cinematic Timeline'),
        'res/actions/sonplaying24.png',
        'res/actions/sonplaying.png'
      )
      .addCodeOnlyParameter('currentScene', '')
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.play');

    extension
      .addAction(
        'Pause',
        _('Pause cinematic'),
        _('Pause the loaded cinematic timeline.'),
        _('Pause cinematic timeline'),
        _('Cinematic Timeline'),
        'res/actions/sonpaused24.png',
        'res/actions/sonpaused.png'
      )
      .addCodeOnlyParameter('currentScene', '')
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.pause');

    extension
      .addAction(
        'Stop',
        _('Stop cinematic'),
        _('Stop the loaded cinematic timeline playback.'),
        _('Stop cinematic timeline'),
        _('Cinematic Timeline'),
        'res/actions/sonstopped24.png',
        'res/actions/sonstopped.png'
      )
      .addCodeOnlyParameter('currentScene', '')
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.stop');

    extension
      .addAction(
        'SetCurrentFrame',
        _('Set current frame'),
        _('Set the current frame and apply it immediately.'),
        _('Set cinematic timeline frame to _PARAM1_'),
        _('Cinematic Timeline'),
        'res/actions/time24.png',
        'res/actions/time.png'
      )
      .addCodeOnlyParameter('currentScene', '')
      .addParameter('number', _('Frame number'), '', false)
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.setCurrentFrame');

    extension
      .addAction(
        'SetLooping',
        _('Set looping'),
        _('Enable or disable looping for cinematic playback.'),
        _('Set cinematic timeline looping: _PARAM1_'),
        _('Cinematic Timeline'),
        'res/actions/timer24.png',
        'res/actions/timer.png'
      )
      .addCodeOnlyParameter('currentScene', '')
      .addParameter('yesorno', _('Enable looping'), '', false)
      .setDefaultValue('yes')
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.setLooping');

    extension
      .addAction(
        'SetPlaybackSpeed',
        _('Set playback speed'),
        _('Change cinematic playback speed. 1 is normal speed.'),
        _('Set cinematic playback speed to _PARAM1_'),
        _('Cinematic Timeline'),
        'res/actions/time24.png',
        'res/actions/time.png'
      )
      .addCodeOnlyParameter('currentScene', '')
      .addParameter('number', _('Playback speed'), '', false)
      .setDefaultValue('1')
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.setPlaybackSpeed');

    extension
      .addAction(
        'PlayShot',
        _('Play shot'),
        _('Play a cinematic shot by id or name.'),
        _('Play cinematic shot _PARAM1_'),
        _('Cinematic Timeline'),
        'res/actions/animation24.png',
        'res/actions/animation.png'
      )
      .addCodeOnlyParameter('currentScene', '')
      .addParameter('string', _('Shot id or name'), '', false)
      .addParameter('yesorno', _('Loop shot playback'), '', false)
      .setDefaultValue('no')
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.playShot');

    extension
      .addAction(
        'PlayRange',
        _('Play frame range'),
        _('Play only inside a custom frame range.'),
        _('Play cinematic range from _PARAM1_ to _PARAM2_'),
        _('Cinematic Timeline'),
        'res/actions/time24.png',
        'res/actions/time.png'
      )
      .addCodeOnlyParameter('currentScene', '')
      .addParameter('number', _('Start frame'), '', false)
      .addParameter('number', _('End frame'), '', false)
      .addParameter('yesorno', _('Loop range playback'), '', false)
      .setDefaultValue('no')
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.playRange');

    extension
      .addAction(
        'SetLoopRange',
        _('Set loop range'),
        _('Set the loop range and enable/disable it.'),
        _('Set loop range enabled _PARAM1_ from _PARAM2_ to _PARAM3_'),
        _('Cinematic Timeline'),
        'res/actions/timer24.png',
        'res/actions/timer.png'
      )
      .addCodeOnlyParameter('currentScene', '')
      .addParameter('yesorno', _('Enable loop range'), '', false)
      .setDefaultValue('yes')
      .addParameter('number', _('Loop in frame'), '', false)
      .addParameter('number', _('Loop out frame'), '', false)
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.setLoopRange');

    extension
      .addAction(
        'ClearTriggeredEvents',
        _('Clear triggered events'),
        _('Clear all event markers triggered on the current frame.'),
        _('Clear cinematic triggered events'),
        _('Cinematic Timeline'),
        'res/actions/delete24.png',
        'res/actions/delete.png'
      )
      .addCodeOnlyParameter('currentScene', '')
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.clearTriggeredEventsLog');

    extension
      .addAction(
        'TriggerEventByIdOrName',
        _('Trigger event marker'),
        _('Trigger an event marker manually by id or name.'),
        _('Trigger cinematic event marker _PARAM1_'),
        _('Cinematic Timeline'),
        'res/actions/animation24.png',
        'res/actions/animation.png'
      )
      .addCodeOnlyParameter('currentScene', '')
      .addParameter('string', _('Event id or name'), '', false)
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.triggerEventByIdOrName');

    extension
      .addCondition(
        'IsPlaying',
        _('Is cinematic playing'),
        _('Check if the cinematic timeline is currently playing.'),
        _('Cinematic timeline is playing'),
        _('Cinematic Timeline'),
        'res/actions/sonplaying24.png',
        'res/actions/sonplaying.png'
      )
      .addCodeOnlyParameter('currentScene', '')
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.isPlaying');

    extension
      .addCondition(
        'HasCinematicLoaded',
        _('Has cinematic loaded'),
        _('Check if a cinematic JSON is loaded and valid.'),
        _('A cinematic timeline is loaded'),
        _('Cinematic Timeline'),
        'res/actions/animation24.png',
        'res/actions/animation.png'
      )
      .addCodeOnlyParameter('currentScene', '')
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.hasLoadedScene');

    extension
      .addCondition(
        'IsLoopRangeEnabled',
        _('Is loop range enabled'),
        _('Check if loop range mode is enabled.'),
        _('Loop range is enabled'),
        _('Cinematic Timeline'),
        'res/actions/timer24.png',
        'res/actions/timer.png'
      )
      .addCodeOnlyParameter('currentScene', '')
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.isLoopRangeEnabled');

    extension
      .addCondition(
        'IsInShot',
        _('Is in shot'),
        _('Check if current frame is inside the given shot.'),
        _('Current frame is in shot _PARAM1_'),
        _('Cinematic Timeline'),
        'res/actions/animation24.png',
        'res/actions/animation.png'
      )
      .addCodeOnlyParameter('currentScene', '')
      .addParameter('string', _('Shot id or name'), '', false)
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.isInShot');

    extension
      .addCondition(
        'WasEventTriggered',
        _('Was event marker triggered'),
        _('Check if an event marker was triggered on the current frame.'),
        _('Cinematic event marker _PARAM1_ was triggered'),
        _('Cinematic Timeline'),
        'res/actions/animation24.png',
        'res/actions/animation.png'
      )
      .addCodeOnlyParameter('currentScene', '')
      .addParameter('string', _('Event id or name'), '', false)
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.wasEventTriggered');

    extension
      .addExpression(
        'CurrentFrame',
        _('Current frame'),
        _('Cinematic Timeline'),
        _('Current cinematic frame'),
        _('Get current cinematic frame number.')
      )
      .addCodeOnlyParameter('currentScene', '')
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.getCurrentFrame');

    extension
      .addExpression(
        'Duration',
        _('Duration in frames'),
        _('Cinematic Timeline'),
        _('Cinematic duration'),
        _('Get cinematic duration in frames.')
      )
      .addCodeOnlyParameter('currentScene', '')
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.getDuration');

    extension
      .addExpression(
        'FPS',
        _('Frames per second'),
        _('Cinematic Timeline'),
        _('Cinematic FPS'),
        _('Get cinematic playback FPS.')
      )
      .addCodeOnlyParameter('currentScene', '')
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.getFps');

    extension
      .addExpression(
        'LoopInFrame',
        _('Loop in frame'),
        _('Cinematic Timeline'),
        _('Cinematic loop in frame'),
        _('Get cinematic loop-in frame.')
      )
      .addCodeOnlyParameter('currentScene', '')
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.getLoopInFrame');

    extension
      .addExpression(
        'LoopOutFrame',
        _('Loop out frame'),
        _('Cinematic Timeline'),
        _('Cinematic loop out frame'),
        _('Get cinematic loop-out frame.')
      )
      .addCodeOnlyParameter('currentScene', '')
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.getLoopOutFrame');

    extension
      .addStrExpression(
        'ActiveShotName',
        _('Active shot name'),
        _('Cinematic Timeline'),
        _('Active cinematic shot name'),
        _('Get active shot name at current frame.')
      )
      .addCodeOnlyParameter('currentScene', '')
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName('gdjs.evtTools.cinematicTimeline.getActiveShotName');

    extension
      .addStrExpression(
        'LastEventName',
        _('Last triggered event name'),
        _('Cinematic Timeline'),
        _('Last triggered cinematic event name'),
        _('Get the name of the last triggered cinematic event marker.')
      )
      .addCodeOnlyParameter('currentScene', '')
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName(
        'gdjs.evtTools.cinematicTimeline.getLastTriggeredEventName'
      );

    extension
      .addStrExpression(
        'LastEventPayload',
        _('Last triggered event payload'),
        _('Cinematic Timeline'),
        _('Last triggered cinematic event payload'),
        _('Get payload of the last triggered cinematic event marker.')
      )
      .addCodeOnlyParameter('currentScene', '')
      .getCodeExtraInformation()
      .setIncludeFile(
        'Extensions/CinematicTimeline/cinematictimelinetools.js'
      )
      .setFunctionName(
        'gdjs.evtTools.cinematicTimeline.getLastTriggeredEventPayload'
      );

    return extension;
  },
  runExtensionSanityTests: function () {
    return [];
  },
};
