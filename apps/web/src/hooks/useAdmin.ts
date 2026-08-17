import { useCallback, useEffect, useState } from 'react';
import type { GameConfig, PlayerId, RoomInfo } from '@polypoly/shared';
import { socket } from '../socket.js';

export interface AdminHandle {
  connected: boolean;
  room: RoomInfo | null;
  config: GameConfig | null;
  resetGame: () => Promise<{ ok: boolean; reason?: string }>;
  kickPlayer: (playerId: PlayerId) => Promise<{ ok: boolean; reason?: string }>;
  grantSquat: (playerId: PlayerId, buildingLevel: number) => Promise<{ ok: boolean; reason?: string }>;
  sendToJail: (playerId: PlayerId) => Promise<{ ok: boolean; reason?: string }>;
}

/** Watches the room like the board display does — no join, just observes —
 *  plus the admin-only reset/kick actions. */
export function useAdmin(): AdminHandle {
  const [connected, setConnected] = useState(socket.connected);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [config, setConfig] = useState<GameConfig | null>(null);

  useEffect(() => {
    function onConnect() {
      setConnected(true);
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onRoomUpdate(nextRoom: RoomInfo, nextConfig: GameConfig) {
      setRoom(nextRoom);
      setConfig(nextConfig);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:update', onRoomUpdate);
    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:update', onRoomUpdate);
    };
  }, []);

  const resetGame = useCallback(() => {
    return new Promise<{ ok: boolean; reason?: string }>((resolve) => {
      socket.emit('admin:reset', resolve);
    });
  }, []);

  const kickPlayer = useCallback((playerId: PlayerId) => {
    return new Promise<{ ok: boolean; reason?: string }>((resolve) => {
      socket.emit('admin:kick', playerId, resolve);
    });
  }, []);

  const grantSquat = useCallback((playerId: PlayerId, buildingLevel: number) => {
    return new Promise<{ ok: boolean; reason?: string }>((resolve) => {
      socket.emit('admin:grant-squat', playerId, buildingLevel, resolve);
    });
  }, []);

  const sendToJail = useCallback((playerId: PlayerId) => {
    return new Promise<{ ok: boolean; reason?: string }>((resolve) => {
      socket.emit('admin:send-to-jail', playerId, resolve);
    });
  }, []);

  return { connected, room, config, resetGame, kickPlayer, grantSquat, sendToJail };
}
