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

    return extension;
  },
  runExtensionSanityTests: function () {
    return [];
  },
};
