// @ts-check
describe('gdjs.SkewRuntimeBehavior', () => {
  const behaviorName = 'Skew';
  const epsilon = 0.0001;

  const createScene = () => {
    const runtimeGame = gdjs.getPixiRuntimeGame();
    return new gdjs.TestRuntimeScene(runtimeGame);
  };

  /**
   * @param {gdjs.RuntimeScene} runtimeScene
   * @param {{
   *   enabled?: boolean,
   *   skewX?: number,
   *   skewY?: number,
   *   maxAbsoluteSkewDegrees?: number,
   *   smoothingResponsiveness?: number,
   *   windEnabled?: boolean,
   *   windAmplitudeX?: number,
   *   windAmplitudeY?: number,
   *   windFrequency?: number,
   *   windTurbulence?: number
   * }=} behaviorProperties
   */
  const addObject = (runtimeScene, behaviorProperties) => {
    const object = new gdjs.TestRuntimeObject(runtimeScene, {
      name: 'Object',
      type: '',
      effects: [],
      variables: [],
      behaviors: [
        {
          type: 'Skew::SkewBehavior',
          name: behaviorName,
          ...behaviorProperties,
        },
      ],
    });
    runtimeScene.addObject(object);
    return object;
  };

  /**
   * @param {number} x
   * @param {number} y
   */
  const createRendererObject = (x = 0, y = 0) => {
    return {
      visible: true,
      skew: {
        x,
        y,
        set(newX, newY) {
          this.x = newX;
          this.y = newY;
        },
      },
    };
  };

  /**
   * @param {gdjs.RuntimeScene} runtimeScene
   * @param {number} frameCount
   * @param {number=} elapsedTimeInMs
   */
  const stepScene = (runtimeScene, frameCount, elapsedTimeInMs = 1000 / 60) => {
    for (let i = 0; i < frameCount; i++) {
      runtimeScene.renderAndStep(elapsedTimeInMs);
    }
  };

  it('applies configured skew in degrees', () => {
    const runtimeScene = createScene();
    const object = addObject(runtimeScene, { skewX: 45, skewY: -30 });
    const rendererObject = createRendererObject();
    object.getRendererObject = () => rendererObject;

    runtimeScene.renderAndStep(1000 / 60);

    expect(Math.abs(rendererObject.skew.x - Math.PI / 4)).to.be.below(epsilon);
    expect(Math.abs(rendererObject.skew.y + Math.PI / 6)).to.be.below(epsilon);
  });

  it('updates skew through behavior methods', () => {
    const runtimeScene = createScene();
    const object = addObject(runtimeScene);
    const rendererObject = createRendererObject();
    object.getRendererObject = () => rendererObject;
    // @ts-ignore
    const behavior = object.getBehavior(behaviorName);

    behavior.setSkewX(10);
    behavior.addSkewX(5);
    behavior.setSkewY(-20);
    behavior.addSkewY(2);

    runtimeScene.renderAndStep(1000 / 60);

    expect(behavior.getSkewX()).to.be(15);
    expect(behavior.getSkewY()).to.be(-18);
    expect(Math.abs(rendererObject.skew.x - (15 * Math.PI) / 180)).to.be.below(
      epsilon
    );
    expect(Math.abs(rendererObject.skew.y - (-18 * Math.PI) / 180)).to.be.below(
      epsilon
    );
  });

  it('interpolates skew values with clamped factors', () => {
    const runtimeScene = createScene();
    const object = addObject(runtimeScene, { skewX: 0, skewY: 0 });
    const rendererObject = createRendererObject();
    object.getRendererObject = () => rendererObject;
    // @ts-ignore
    const behavior = object.getBehavior(behaviorName);

    behavior.interpolateSkewX(10, 0.5);
    behavior.interpolateSkewY(-20, 0.25);
    runtimeScene.renderAndStep(1000 / 60);

    expect(behavior.getSkewX()).to.be(5);
    expect(behavior.getSkewY()).to.be(-5);

    behavior.interpolateSkew(40, 10, 2); // Clamped to 1.
    runtimeScene.renderAndStep(1000 / 60);

    expect(behavior.getSkewX()).to.be(40);
    expect(behavior.getSkewY()).to.be(10);

    behavior.interpolateSkewX(0, -3); // Clamped to 0.
    runtimeScene.renderAndStep(1000 / 60);

    expect(behavior.getSkewX()).to.be(40);
  });

  it('restores previous skew when disabled', () => {
    const runtimeScene = createScene();
    const object = addObject(runtimeScene, { skewX: 25, skewY: 12 });
    const rendererObject = createRendererObject(0.3, -0.2);
    object.getRendererObject = () => rendererObject;
    // @ts-ignore
    const behavior = object.getBehavior(behaviorName);

    runtimeScene.renderAndStep(1000 / 60);
    expect(rendererObject.skew.x).to.not.be(0.3);
    expect(rendererObject.skew.y).to.not.be(-0.2);

    behavior.setEnabled(false);

    expect(Math.abs(rendererObject.skew.x - 0.3)).to.be.below(epsilon);
    expect(Math.abs(rendererObject.skew.y + 0.2)).to.be.below(epsilon);
  });

  it('handles renderers without skew support safely', () => {
    const runtimeScene = createScene();
    const object = addObject(runtimeScene, { skewX: 40, skewY: 40 });
    object.getRendererObject = () => ({ visible: true });
    // @ts-ignore
    const behavior = object.getBehavior(behaviorName);

    runtimeScene.renderAndStep(1000 / 60);
    behavior.setSkew(5, 6);
    behavior.resetSkew();

    expect(behavior.getSkewX()).to.be(0);
    expect(behavior.getSkewY()).to.be(0);
  });

  it('clamps skew values to a safe range', () => {
    const runtimeScene = createScene();
    const object = addObject(runtimeScene, {
      skewX: 120,
      skewY: -200,
      maxAbsoluteSkewDegrees: 70,
    });
    const rendererObject = createRendererObject();
    object.getRendererObject = () => rendererObject;
    // @ts-ignore
    const behavior = object.getBehavior(behaviorName);

    stepScene(runtimeScene, 1);

    expect(behavior.getSkewX()).to.be(70);
    expect(behavior.getSkewY()).to.be(-70);
    expect(Math.abs(rendererObject.skew.x - (70 * Math.PI) / 180)).to.be.below(
      epsilon
    );
    expect(
      Math.abs(rendererObject.skew.y - (-70 * Math.PI) / 180)
    ).to.be.below(epsilon);
  });

  it('smooths skew using responsiveness over time', () => {
    const runtimeScene = createScene();
    const object = addObject(runtimeScene, {
      skewX: 0,
      skewY: 0,
      smoothingResponsiveness: 12,
    });
    const rendererObject = createRendererObject();
    object.getRendererObject = () => rendererObject;
    // @ts-ignore
    const behavior = object.getBehavior(behaviorName);

    stepScene(runtimeScene, 1);
    behavior.setSkewX(60);
    stepScene(runtimeScene, 1);

    const currentSkewXDegrees = (rendererObject.skew.x * 180) / Math.PI;
    expect(currentSkewXDegrees).to.be.above(1);
    expect(currentSkewXDegrees).to.be.below(60);
    expect(behavior.getSkewX()).to.be(60);

    stepScene(runtimeScene, 120);
    const settledSkewXDegrees = (rendererObject.skew.x * 180) / Math.PI;
    expect(Math.abs(settledSkewXDegrees - 60)).to.be.below(0.15);
  });

  it('interpolates skew with frame-rate independent speed action', () => {
    const runtimeScene = createScene();
    const object = addObject(runtimeScene, { skewX: 0, skewY: 0 });
    const rendererObject = createRendererObject();
    object.getRendererObject = () => rendererObject;
    // @ts-ignore
    const behavior = object.getBehavior(behaviorName);

    stepScene(runtimeScene, 1);
    behavior.interpolateSkewXBySpeed(30, 12);
    stepScene(runtimeScene, 1);

    expect(behavior.getSkewX()).to.be.above(0);
    expect(behavior.getSkewX()).to.be.below(30);
    expect((rendererObject.skew.x * 180) / Math.PI).to.be.above(0);
  });

  it('adds procedural wind sway offsets when enabled', () => {
    const runtimeScene = createScene();
    const object = addObject(runtimeScene, {
      skewX: 0,
      skewY: 0,
      windEnabled: true,
      windAmplitudeX: 8,
      windAmplitudeY: 3,
      windFrequency: 1.3,
      windTurbulence: 0.6,
    });
    const rendererObject = createRendererObject();
    object.getRendererObject = () => rendererObject;

    stepScene(runtimeScene, 1);
    const firstX = rendererObject.skew.x;
    const firstY = rendererObject.skew.y;

    stepScene(runtimeScene, 12);
    const secondX = rendererObject.skew.x;
    const secondY = rendererObject.skew.y;

    expect(Math.abs(secondX - firstX)).to.be.above(0.001);
    expect(Math.abs(secondY - firstY)).to.be.above(0.001);
  });
});
