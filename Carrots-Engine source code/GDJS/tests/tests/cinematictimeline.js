// @ts-check

describe('gdjs.evtTools.cinematicTimeline', function () {
  const makeRuntimeScenePayload = () => ({
    version: 1,
    name: 'Intro',
    fps: 30,
    duration: 30,
    tracks: [],
    loopRange: {
      enabled: false,
      inFrame: 0,
      outFrame: 30,
    },
    shots: [
      {
        id: 'shot-1',
        name: 'Intro Shot',
        startFrame: 10,
        endFrame: 20,
      },
    ],
    events: [
      {
        id: 'event-start',
        name: 'StartCue',
        action: 'Trigger',
        condition: 'Always',
        frame: 0,
        payload: 'boot',
      },
      {
        id: 'event-shot',
        name: 'ShotCue',
        action: 'Trigger',
        condition: 'Always',
        frame: 10,
        payload: 'shot',
      },
    ],
  });

  const makeWrappedPayload = runtimeScene => ({
    format: 'carrots-cinematic-timeliner-v1',
    version: 2,
    sceneName: runtimeScene.name,
    activeSceneName: runtimeScene.name,
    fps: runtimeScene.fps,
    runtimeScene,
  });

  const createRuntimeScene = () => {
    const runtimeGame = gdjs.getPixiRuntimeGame();
    return new gdjs.RuntimeScene(runtimeGame);
  };

  it('can load a wrapped editor payload from JSON', function () {
    const runtimeScene = createRuntimeScene();
    const payload = makeWrappedPayload(makeRuntimeScenePayload());

    gdjs.evtTools.cinematicTimeline.loadFromJson(
      runtimeScene,
      JSON.stringify(payload)
    );

    expect(gdjs.evtTools.cinematicTimeline.hasLoadedScene(runtimeScene)).to.be(
      true
    );
    expect(gdjs.evtTools.cinematicTimeline.getDuration(runtimeScene)).to.be(30);
    expect(gdjs.evtTools.cinematicTimeline.getFps(runtimeScene)).to.be(30);
  });

  it('triggers first-frame events immediately on load and play from project storage', function () {
    const runtimeScene = createRuntimeScene();
    const payload = makeWrappedPayload(makeRuntimeScenePayload());

    runtimeScene
      .getGame()
      .getVariables()
      .get('__carrots_cinematic_timeliner_v1')
      .setString(JSON.stringify(payload));

    gdjs.evtTools.cinematicTimeline.loadAndPlayFromProjectStorage(runtimeScene);

    expect(gdjs.evtTools.cinematicTimeline.isPlaying(runtimeScene)).to.be(true);
    expect(gdjs.evtTools.cinematicTimeline.getCurrentFrame(runtimeScene)).to.be(0);
    expect(
      gdjs.evtTools.cinematicTimeline.wasEventTriggered(runtimeScene, 'StartCue')
    ).to.be(true);
    expect(
      gdjs.evtTools.cinematicTimeline.getLastTriggeredEventPayload(runtimeScene)
    ).to.be('boot');
  });

  it('triggers events on the first frame of a shot when playback starts', function () {
    const runtimeScene = createRuntimeScene();
    const payload = makeRuntimeScenePayload();

    gdjs.evtTools.cinematicTimeline.loadFromJson(
      runtimeScene,
      JSON.stringify(payload)
    );
    gdjs.evtTools.cinematicTimeline.playShot(runtimeScene, 'Intro Shot', false);

    expect(gdjs.evtTools.cinematicTimeline.isPlaying(runtimeScene)).to.be(true);
    expect(gdjs.evtTools.cinematicTimeline.getCurrentFrame(runtimeScene)).to.be(10);
    expect(
      gdjs.evtTools.cinematicTimeline.wasEventTriggered(runtimeScene, 'ShotCue')
    ).to.be(true);
    expect(
      gdjs.evtTools.cinematicTimeline.getLastTriggeredEventPayload(runtimeScene)
    ).to.be('shot');
  });
});
