import * as pixi_spine from '@esotericsoftware/spine-pixi-v8';

export = pixi_spine;
export as namespace pixi_spine;

declare global {
  namespace PIXI {
    export import Spine = pixi_spine.Spine;
  }
}
