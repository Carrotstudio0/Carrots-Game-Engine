// @flow
import * as PIXI from 'pixi.js-legacy';
import {
  getBasicProfilingCountersText,
  type BasicProfilingCounters,
} from './InstancesRenderer/BasicProfilingCounters';

type FramePerformanceSnapshot = {|
  fps: number,
  fpsSmoothed: number,
  frameTimeMs: number,
  frameTimeMsSmoothed: number,
  frameCpuTimeMs: number,
  frameCpuTimeMsSmoothed: number,
  drawCalls: number,
  triangles: number,
  lines: number,
  points: number,
  geometries: number,
  textures: number,
|};

export default class ProfilerBar {
  // $FlowFixMe[value-as-type]
  _profilerBarContainer: PIXI.Container;
  // $FlowFixMe[value-as-type]
  _profilerBarBackground: PIXI.Graphics;
  // $FlowFixMe[value-as-type]
  _profilerBarText: PIXI.Text;

  constructor() {
    this._profilerBarContainer = new PIXI.Container();
    this._profilerBarContainer.alpha = 0.8;
    this._profilerBarContainer.hitArea = new PIXI.Rectangle(0, 0, 0, 0);
    this._profilerBarBackground = new PIXI.Graphics();
    this._profilerBarText = new PIXI.Text('', {
      fontSize: 12,
      fill: 0xffffff,
      align: 'left',
    });
    this._profilerBarContainer.addChild(this._profilerBarBackground);
    this._profilerBarContainer.addChild(this._profilerBarText);
  }

  // $FlowFixMe[value-as-type]
  getPixiObject(): PIXI.Container {
    return this._profilerBarContainer;
  }

  render({
    basicProfilingCounters,
    framePerformanceSnapshot,
    display,
    showDetails,
  }: {|
    basicProfilingCounters: BasicProfilingCounters,
    framePerformanceSnapshot?: ?FramePerformanceSnapshot,
    display: boolean,
    showDetails?: boolean,
  |}) {
    if (!display) {
      this._profilerBarContainer.visible = false;
      return;
    }

    this._profilerBarContainer.visible = true;
    const textPadding = 5;
    const profilerBarPadding = 15;
    const borderRadius = 6;
    const textXPosition = profilerBarPadding + textPadding;
    const textYPosition = profilerBarPadding + textPadding;

    const texts = [];
    const stats = framePerformanceSnapshot;
    if (stats) {
      texts.push(
        `FPS: ${stats.fps.toFixed(1)} (avg ${stats.fpsSmoothed.toFixed(
          1
        )}) | Frame: ${stats.frameTimeMs.toFixed(
          2
        )}ms (avg ${stats.frameTimeMsSmoothed.toFixed(2)}ms)`
      );
      texts.push(
        `CPU: ${stats.frameCpuTimeMs.toFixed(
          2
        )}ms (avg ${stats.frameCpuTimeMsSmoothed.toFixed(
          2
        )}ms) | Draw Calls: ${stats.drawCalls}`
      );
      texts.push(
        `Triangles: ${stats.triangles} | Lines: ${stats.lines} | Points: ${stats.points}`
      );
      texts.push(
        `GPU Memory -> Geometries: ${stats.geometries} | Textures: ${stats.textures}`
      );
    }

    if (showDetails) {
      if (texts.length > 0) texts.push(' ');
      texts.push(getBasicProfilingCountersText(basicProfilingCounters));
    }

    this._profilerBarText.text = texts.join('\n');
    this._profilerBarText.position.x = textXPosition;
    this._profilerBarText.position.y = textYPosition;

    const profilerBarXPosition = profilerBarPadding;
    const profilerBarYPosition = profilerBarPadding;
    const profilerBarWidth = this._profilerBarText.width + textPadding * 2;
    const profilerBarHeight = this._profilerBarText.height + textPadding * 2;

    this._profilerBarBackground.clear();
    this._profilerBarBackground.beginFill(0x000000, 0.8);
    this._profilerBarBackground.drawRoundedRect(
      profilerBarXPosition,
      profilerBarYPosition,
      profilerBarWidth,
      profilerBarHeight,
      borderRadius
    );
    this._profilerBarBackground.endFill();
  }
}
