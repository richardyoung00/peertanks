import { WEAPON_IDS } from '../sim/items';
import type { PlayerInput } from '../sim/player-input';
import type { ByteReader, ByteWriter } from './binary';

export const INPUT_FRAME_BYTES = 12;
const NO_WEAPON_CHANGE = 0;

export interface InputFrame {
  seq: number;
  input: PlayerInput;
}

export function writeInputFrame(writer: ByteWriter, { seq, input }: InputFrame): void {
  writer.u32(seq);
  writer.i8(Math.sign(input.moveX));
  writer.i8(Math.sign(input.moveY));
  writer.angle(input.aimAngle);
  writer.distance(input.aimDistance);
  writer.u8(input.firing ? 1 : 0);
  writer.u8(input.selectWeapon ? WEAPON_IDS.indexOf(input.selectWeapon) + 1 : NO_WEAPON_CHANGE);
}

export function readInputFrame(reader: ByteReader): InputFrame {
  const seq = reader.u32();
  const moveX = reader.i8();
  const moveY = reader.i8();
  const aimAngle = reader.angle();
  const aimDistance = reader.distance();
  const firing = reader.u8() === 1;
  const weaponIndex = reader.u8();
  const selectWeapon = weaponIndex === NO_WEAPON_CHANGE ? null : (WEAPON_IDS[weaponIndex - 1] ?? null);
  return { seq, input: { moveX, moveY, aimAngle, aimDistance, firing, selectWeapon } };
}
