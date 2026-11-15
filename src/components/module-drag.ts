import type { PatchModule } from '../domain/types';
import { snapPosition, type Point } from '../domain/workspace';

interface DragPointer {
  pointerId: number;
  clientX: number;
  clientY: number;
}

interface DragPosition extends Point {
  id: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  moduleX: number;
  moduleY: number;
  clientX: number;
  clientY: number;
}

/** One pointer owns a module move. Take its final position before clearing the
 * preview, so a later capture-loss notification cannot discard a completed edit.
 */
export class ModuleDrag {
  current: DragPosition | null = null;

  start(module: PatchModule, pointer: DragPointer, point: Point) {
    if (this.current) return;
    this.current = {
      id: module.id,
      pointerId: pointer.pointerId,
      offsetX: point.x - module.x,
      offsetY: point.y - module.y,
      moduleX: module.x,
      moduleY: module.y,
      clientX: pointer.clientX,
      clientY: pointer.clientY,
      x: module.x,
      y: module.y,
    };
  }

  move(pointer: DragPointer, point: Point) {
    const current = this.current;
    if (!current || current.pointerId !== pointer.pointerId) return null;
    const position = snapPosition(point.x - current.offsetX, point.y - current.offsetY);
    this.current = { ...current, ...position, clientX: pointer.clientX, clientY: pointer.clientY };
    return this.current;
  }

  release(pointer: DragPointer, point: Point) {
    this.move(pointer, point);
    return this.take(pointer.pointerId);
  }

  lostCapture(pointerId: number, buttons: number) {
    // Some release paths deliver capture loss without a bubbling pointerup.
    // A released pointer finishes at its last preview; capture lost while still
    // pressed is cancellation. Lost-capture coordinates are not reliable.
    if (buttons === 0) return this.take(pointerId);
    this.cancel(pointerId);
    return null;
  }

  cancel(pointerId?: number) {
    if (pointerId === undefined || this.current?.pointerId === pointerId) this.current = null;
  }

  private take(pointerId: number) {
    if (this.current?.pointerId !== pointerId) return null;
    const position = this.current;
    this.current = null;
    return position;
  }
}
