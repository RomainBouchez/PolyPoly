import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { RoomSnapshot } from './room.js';

// Overridable so Docker can point this at a mounted volume; defaults to a
// file next to the project for plain `npm run dev` usage.
const SNAPSHOT_PATH = process.env.ROOM_SNAPSHOT_PATH
  ? process.env.ROOM_SNAPSHOT_PATH
  : new URL('../room.snapshot.json', import.meta.url);

export function saveSnapshot(snapshot: RoomSnapshot): void {
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot), 'utf-8');
}

export function loadSnapshot(): RoomSnapshot | null {
  if (!existsSync(SNAPSHOT_PATH)) return null;
  try {
    return JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf-8')) as RoomSnapshot;
  } catch {
    return null;
  }
}
