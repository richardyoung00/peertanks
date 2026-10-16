import { StoredSetting } from '../settings/stored-setting';

export type GraphicsQuality = 'high' | 'low';

const setting = new StoredSetting<GraphicsQuality>('tanks.graphics', (stored) => (stored === 'low' ? 'low' : 'high'));

export function graphicsQuality(): GraphicsQuality {
  return setting.get();
}

/** Changes the setting, remembers it for next time and tells anything drawing the game straight away. */
export function setGraphicsQuality(quality: GraphicsQuality): void {
  setting.set(quality);
}

/** Returns a function that stops listening. */
export function onGraphicsQualityChange(listener: (quality: GraphicsQuality) => void): () => void {
  return setting.onChange(listener);
}
