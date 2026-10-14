import type { HostMessage } from './messages';

// The join request and the rejection reply must keep this exact shape forever, so that any two builds,
// however far apart, can still tell each other they don't match.

export type RejectionCode = 'full' | 'client-outdated' | 'host-outdated';

const HARD_REFRESH = 'Do a hard refresh (Ctrl+Shift+R, or Cmd+Shift+R on a Mac)';

export const OUTDATED_JOINER_MESSAGE = `Your copy of the game is older than the host's. ${HARD_REFRESH}, then join again.`;

export const OUTDATED_HOST_MESSAGE =
  'The host is running an older version of the game. Ask them to do a hard refresh and host a new game, then join again.';

export const OUTDATED_HOST_WARNING =
  `A player with a newer version of the game tried to join and couldn't. ${HARD_REFRESH} and host a new game so everyone can play.`;

/** Uses our own wording when we know the code; older hosts only send their text. */
export function rejectionMessage(message: Extract<HostMessage, { type: 'rejected' }>): string {
  if (message.code === 'client-outdated') return OUTDATED_JOINER_MESSAGE;
  if (message.code === 'host-outdated') return OUTDATED_HOST_MESSAGE;
  return message.reason;
}
