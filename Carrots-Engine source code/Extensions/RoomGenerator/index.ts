/**
 * Room Generator Extension Runtime Entry Point
 */

import { RoomGenerator } from './RoomGenerator';

const gdjs = (window as any).gdjs;

let roomGenerator: RoomGenerator | null = null;

gdjs.roomGenerator = {
  generateRooms(
    runtimeScene: any,
    roomCount: number,
    minSize: number,
    maxSize: number,
    wallThickness: number,
    height: number,
    corridorWidth: number
  ) {
    if (!roomGenerator) {
      roomGenerator = new RoomGenerator();
    }

    const layout = roomGenerator.generateLayout(
      Math.round(roomCount),
      minSize,
      maxSize,
      wallThickness,
      height,
      corridorWidth
    );

    const geometry = roomGenerator.createGeometry(wallThickness);

    // Add to scene
    if (runtimeScene.getLayer('') && runtimeScene.getLayer('').getRenderer()) {
      const renderer = runtimeScene.getLayer('').getRenderer();
      if (renderer.getThreeScene) {
        renderer.getThreeScene().add(geometry);
      }
    }
  },

  clearRooms(runtimeScene: any) {
    if (roomGenerator) {
      const group = roomGenerator.getRoomGroup();
      if (group && group.parent) {
        group.parent.remove(group);
      }
      roomGenerator.clear();
    }
  },

  areRoomsGenerated(): boolean {
    if (!roomGenerator) return false;
    return roomGenerator.getRoomGroup() !== null;
  },
};

export {};