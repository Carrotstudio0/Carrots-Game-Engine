// @flow
import * as PIXI from 'pixi.js-legacy';
import * as THREE from 'three';
import Rectangle from '../Utils/Rectangle';
import { type InstancesEditorSettings } from './InstancesEditorSettings';
import RenderedInstance from '../ObjectsRendering/Renderers/RenderedInstance';

type Props = {|
  initialViewX: number,
  initialViewY: number,
  width: number,
  height: number,
  instancesEditorSettings: InstancesEditorSettings,
|};

export default class ViewPosition {
  viewX: number = 0;
  viewY: number = 0;
  _width: number;
  _height: number;
  instancesEditorSettings: InstancesEditorSettings;
  // $FlowFixMe[missing-local-annot]
  _pixiContainer = (new PIXI.Container(): any);

  _sanitizeCoordinate = (value: number, fallback: number = 0): number => {
    return isFinite(value) ? value : fallback;
  };

  constructor({
    initialViewX,
    initialViewY,
    width,
    height,
    instancesEditorSettings,
  }: Props) {
    this.viewX = this._sanitizeCoordinate(initialViewX, 0);
    this.viewY = this._sanitizeCoordinate(initialViewY, 0);
    this.instancesEditorSettings = instancesEditorSettings;
    this.resize(width, height);
  }

  setInstancesEditorSettings(instancesEditorSettings: InstancesEditorSettings) {
    this.instancesEditorSettings = instancesEditorSettings;
  }

  resize(width: number, height: number) {
    this._width = isFinite(width) ? width : 0;
    this._height = isFinite(height) ? height : 0;
  }

  _getSafeZoomFactor = (): number => {
    const zoomFactor = this.instancesEditorSettings.zoomFactor;
    if (!isFinite(zoomFactor) || zoomFactor === 0) {
      return 1;
    }
    return Math.abs(zoomFactor);
  };

  getWidth(): any {
    return this._width;
  }

  getHeight(): any {
    return this._height;
  }

  containsPoint(x: number, y: number): any {
    const canvasPoint = this.toCanvasCoordinates(x, y);
    return (
      0 <= canvasPoint[0] &&
      canvasPoint[0] <= this._width &&
      0 <= canvasPoint[1] &&
      canvasPoint[1] <= this._height
    );
  }

  /**
   * Convert a point from the canvas coordinates (for example, the mouse position) to the
   * "world" coordinates.
   */
  toSceneCoordinates = (x: number, y: number): [number, number] => {
    const safeZoomFactor = this._getSafeZoomFactor();
    x -= this._width / 2;
    y -= this._height / 2;
    x /= safeZoomFactor;
    y /= safeZoomFactor;

    var viewRotation = 0;
    var tmp = x;
    x =
      Math.cos((viewRotation / 180) * Math.PI) * x -
      Math.sin((viewRotation / 180) * Math.PI) * y;
    y =
      Math.sin((viewRotation / 180) * Math.PI) * tmp +
      Math.cos((viewRotation / 180) * Math.PI) * y;

    return [x + this.viewX, y + this.viewY];
  };

  /**
   * Convert a length from canvas referential to scene referential.
   */
  toSceneScale = (a: number): number =>
    a / this._getSafeZoomFactor();
  /**
   * Convert a length from scene referential to canvas referential.
   */
  toCanvasScale = (a: number): number =>
    a * this._getSafeZoomFactor();

  /**
   * Convert a point from the "world" coordinates (for example, an object position) to the
   * canvas coordinates.
   */
  toCanvasCoordinates = (x: number, y: number): [number, number] => {
    const safeZoomFactor = this._getSafeZoomFactor();
    x -= this.viewX;
    y -= this.viewY;

    var viewRotation = -0;
    var tmp = x;
    x =
      Math.cos((viewRotation / 180) * Math.PI) * x -
      Math.sin((viewRotation / 180) * Math.PI) * y;
    y =
      Math.sin((viewRotation / 180) * Math.PI) * tmp +
      Math.cos((viewRotation / 180) * Math.PI) * y;

    x *= safeZoomFactor;
    y *= safeZoomFactor;

    return [x + this._width / 2, y + this._height / 2];
  };

  scrollBy(x: number, y: number) {
    this.viewX = this._sanitizeCoordinate(this.viewX + x, this.viewX);
    this.viewY = this._sanitizeCoordinate(this.viewY + y, this.viewY);
  }

  scrollTo(x: number, y: number) {
    this.viewX = this._sanitizeCoordinate(x, this.viewX);
    this.viewY = this._sanitizeCoordinate(y, this.viewY);
  }

  /**
   * Moves view to the rectangle center and returns the ideal zoom
   * factor to fit to the rectangle.
   */
  fitToRectangle(rectangle: Rectangle): number {
    this.viewX = this._sanitizeCoordinate(rectangle.centerX(), this.viewX);
    this.viewY = this._sanitizeCoordinate(rectangle.centerY(), this.viewY);
    const idealZoomOnX = this._width / rectangle.width();
    const idealZoomOnY = this._height / rectangle.height();

    const idealZoom = Math.min(idealZoomOnX, idealZoomOnY) * 0.95;
    return isFinite(idealZoom) && idealZoom > 0 ? idealZoom : 1; // Add margin so that the object doesn't feel cut
  }

  getViewX(): any {
    return this.viewX;
  }

  getViewY(): any {
    return this.viewY;
  }

  // $FlowFixMe[value-as-type]
  applyTransformationToPixi(container: PIXI.Container) {
    const safeZoomFactor = this._getSafeZoomFactor();
    container.position.x =
      -this.viewX * safeZoomFactor;
    container.position.y =
      -this.viewY * safeZoomFactor;
    container.position.x += this._width / 2;
    container.position.y += this._height / 2;
    container.scale.x = safeZoomFactor;
    container.scale.y = safeZoomFactor;
  }

  applyTransformationToThree(
    // $FlowFixMe[value-as-type]
    threeCamera: THREE.Camera,
    // $FlowFixMe[value-as-type]
    threePlaneMesh: THREE.Mesh
  ) {
    const width = this._width > 0 ? this._width : 1;
    const height = this._height > 0 ? this._height : 1;
    threeCamera.aspect = width / height;

    const zoomFactor = this._getSafeZoomFactor();
    const safeFovDegrees = isFinite(threeCamera.fov)
      ? Math.max(5, Math.min(170, threeCamera.fov))
      : 45;
    if (safeFovDegrees !== threeCamera.fov) {
      threeCamera.fov = safeFovDegrees;
    }

    threeCamera.position.x = this.viewX;
    threeCamera.position.y = -this.viewY; // Inverted because the scene is mirrored on Y axis.
    threeCamera.rotation.z = 0;

    // Set the camera so that it displays the whole PixiJS plane, as if it was a 2D rendering.
    // The Z position is computed by taking the half height of the displayed rendering,
    // and using the angle of the triangle defined by the field of view to compute the length
    // of the triangle defining the distance between the camera and the rendering plane.
    const cameraFovInRadians = RenderedInstance.toRad(safeFovDegrees);
    const tangent = Math.tan(0.5 * cameraFovInRadians);
    const safeTangent = Math.max(0.0001, Math.abs(tangent));
    const cameraZPosition =
      (0.5 * height) / zoomFactor / safeTangent;
    threeCamera.position.z = cameraZPosition;
    threeCamera.far = cameraZPosition + 2000;
    threeCamera.updateProjectionMatrix();

    // Adapt the plane size so that it covers the whole screen.
    threePlaneMesh.scale.x = width / zoomFactor;
    threePlaneMesh.scale.y = height / zoomFactor;
    // Adapt the plane position so that it's always displayed on the whole screen.
    threePlaneMesh.position.x = threeCamera.position.x;
    threePlaneMesh.position.y = -threeCamera.position.y; // Inverted because the scene is mirrored on Y axis.
    threePlaneMesh.rotation.z = 0;
  }
}
