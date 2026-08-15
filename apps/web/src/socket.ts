import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@polypoly/shared';

const SERVER_URL = import.meta.env.DEV
  ? `http://${window.location.hostname}:${import.meta.env.VITE_SERVER_PORT ?? 4000}`
  : undefined;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
  autoConnect: true,
});
