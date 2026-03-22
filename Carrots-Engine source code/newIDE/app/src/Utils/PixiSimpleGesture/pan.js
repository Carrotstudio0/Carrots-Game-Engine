// @flow
import * as PIXI from 'pixi.js';
import {
  getPixiOriginalEvent,
  isPixiPrimaryEvent,
} from '../PixiCompat/EditorPixiAdapter';

export type PanMoveEvent = {|
  deltaX: number,
  deltaY: number,
  velocity: number,
  // $FlowFixMe[value-as-type]
  data: PIXI.FederatedPointerEvent,
|};

export default function panable(
  // $FlowFixMe[value-as-type]
  sprite: PIXI.DisplayObject,
  inertia: boolean = false
) {
  const getPointerEventFromPixiEvent = (event: any): any => {
    const originalEvent = getPixiOriginalEvent(event);
    if (!originalEvent) {
      return null;
    }

    if (originalEvent.nativeEvent) {
      return originalEvent.nativeEvent;
    }

    if (originalEvent.touches && originalEvent.touches.length > 0) {
      return originalEvent.touches[0];
    }

    if (
      originalEvent.changedTouches &&
      originalEvent.changedTouches.length > 0
    ) {
      return originalEvent.changedTouches[0];
    }

    return originalEvent;
  };

  const isMouseLikeEvent = (event: any): boolean => {
    if (!event) return false;
    if (event.pointerType === 'mouse') return true;
    if (typeof MouseEvent === 'function' && event instanceof MouseEvent) {
      return true;
    }
    return typeof event.type === 'string' && event.type.indexOf('mouse') === 0;
  };

  // $FlowFixMe[value-as-type]
  function pointerDown(e: PIXI.FederatedPointerEvent) {
    const pointerEvent = getPointerEventFromPixiEvent(e);
    if (!pointerEvent) return;
    start(pointerEvent);
  }

  function start(t: any) {
    if (sprite._pan) {
      if (!sprite._pan.intervalId) {
        return;
      }
      clearInterval(sprite._pan.intervalId);
      sprite.emit('panend');
    }
    sprite._pan = {
      p: {
        x: t.clientX,
        y: t.clientY,
        date: new Date(),
      },
    };
    sprite.on('globalpointermove', pointerMove);
  }

  // $FlowFixMe[value-as-type]
  function pointerMove(e: PIXI.FederatedPointerEvent) {
    const touch = getPointerEventFromPixiEvent(e);
    if (!touch) return;

    if (!isPixiPrimaryEvent(e)) {
      end(e, touch);
      return;
    }
    move(e, touch);
  }

  // $FlowFixMe[value-as-type]
  function move(e: PIXI.FederatedPointerEvent, t: any) {
    let now = new Date();
    let interval = now - sprite._pan.p.date;
    if (interval < 12) {
      return;
    }
    let dx = t.clientX - sprite._pan.p.x;
    let dy = t.clientY - sprite._pan.p.y;
    let distance = Math.sqrt(dx * dx + dy * dy);
    if (!sprite._pan.pp) {
      let threshold = isMouseLikeEvent(t) ? 2 : 7;
      if (distance > threshold) {
        sprite.emit('panstart');
      } else {
        return;
      }
    } else {
      let event: PanMoveEvent = {
        deltaX: dx,
        deltaY: dy,
        velocity: distance / interval,
        data: e.data,
      };
      sprite.emit('panmove', event);
    }
    sprite._pan.pp = {
      x: sprite._pan.p.x,
      y: sprite._pan.p.y,
      date: sprite._pan.p.date,
    };
    sprite._pan.p = {
      x: t.clientX,
      y: t.clientY,
      date: now,
    };
  }

  // $FlowFixMe[value-as-type]
  function pointerUp(e: PIXI.FederatedPointerEvent) {
    const pointerEvent = getPointerEventFromPixiEvent(e);
    if (!pointerEvent) {
      sprite.off('globalpointermove', pointerMove);
      sprite.emit('panend');
      sprite._pan = null;
      return;
    }
    end(e, pointerEvent);
  }

  // $FlowFixMe[value-as-type]
  function end(e: PIXI.FederatedPointerEvent, t: any) {
    sprite.off('globalpointermove', pointerMove);
    if (!sprite._pan || !sprite._pan.pp) {
      sprite._pan = null;
      return;
    }
    if (inertia && t) {
      if (sprite._pan.intervalId) {
        return;
      }
      let interval = new Date() - sprite._pan.pp.date;
      let vx = (t.clientX - sprite._pan.pp.x) / interval;
      let vy = (t.clientY - sprite._pan.pp.y) / interval;
      sprite._pan.intervalId = setInterval(() => {
        if (Math.abs(vx) < 0.04 && Math.abs(vy) < 0.04) {
          clearInterval(sprite._pan.intervalId);
          sprite.emit('panend');
          sprite._pan = null;
          return;
        }
        let touch = {
          clientX: sprite._pan.p.x + vx * 12,
          clientY: sprite._pan.p.y + vy * 12,
        };
        // $FlowFixMe[incompatible-type]
        move(e, touch);
        vx *= 0.9;
        vy *= 0.9;
      }, 12);
    } else {
      sprite.emit('panend');
      sprite._pan = null;
    }
  }

  sprite.eventMode = 'static';
  sprite.on('pointerdown', pointerDown);
  sprite.on('pointerup', pointerUp);
  sprite.on('pointerupoutside', pointerUp);
}
