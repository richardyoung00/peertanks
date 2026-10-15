const BOT_NAMES = [
  'Rusty',
  'Major Boom',
  'Sgt. Treads',
  'Clank',
  'Tin Can',
  'Big Bertha',
  'Sprocket',
  'Dozer',
  'Captain Kaboom',
  'Rivets',
  'Shellshock',
  'Gearbox',
  'Bolt',
  'Turret Tom',
  'Grinder',
  'Old Smokey',
];

/** A random bot name nobody in the game is using yet. */
export function pickBotName(takenNames: string[], random = Math.random): string {
  const free = BOT_NAMES.filter((name) => !takenNames.includes(name));
  const choices = free.length > 0 ? free : BOT_NAMES;
  return choices[Math.floor(random() * choices.length)];
}
