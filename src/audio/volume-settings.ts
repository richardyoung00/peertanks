import { StoredSetting } from '../settings/stored-setting';

export type VolumeChannel = 'master' | 'effects' | 'announcer' | 'menus';

/** Volumes are whole percentages, 0–100. */
const DEFAULT_VOLUMES: Record<VolumeChannel, number> = {
  master: 80,
  effects: 100,
  announcer: 100,
  menus: 60,
};

function volumeSetting(channel: VolumeChannel): StoredSetting<number> {
  return new StoredSetting(`tanks.volume.${channel}`, (stored) => parseVolume(stored, DEFAULT_VOLUMES[channel]));
}

function parseVolume(stored: string | null, fallback: number): number {
  const value = Number(stored);
  if (stored === null || !Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export const VOLUMES: Record<VolumeChannel, StoredSetting<number>> = {
  master: volumeSetting('master'),
  effects: volumeSetting('effects'),
  announcer: volumeSetting('announcer'),
  menus: volumeSetting('menus'),
};
