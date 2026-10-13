Game idea:
- top down tank-style shooter similar to blocktanks.
- each user has their own tank that is centered on the screen, they use the arrow keys to move. Movement is relative to the screen and not relative to the position of the tank. i.e. the left arrow makes the tank move to the left of the screen.
- the player uses the mouse cursor to point the turret. The turret always points toward the cursor.
- clicking the mouse button fires the weapon.
- the user collects weapons and ammo on the map.
- the user has a base cannon fire that never runs out of ammo.
- the map is a constrained fixed size arena with areas where the players can and cannot move.
- Some weapons bullets do not pass through terrain (mountains, trees etc)
- some weapons can be thrown over terrain (like mortars)
- certain areas of the map cause the player do die, like walking into lava or water or off a cliff.
- some weapons need to be able to bounce off terrain, for example a single bullet that can bounce 2 times in a straight line, or a lazer that can deflect a fixed number of times.
- each user has a fixed health, and various weapons deplete different amounts of health. Things like rockets or grenades should kill immediately, unless the user is further away from the explosion. SOme weapons like the default cannon would require 10 shots to kill a player on full health.
- players need to make use of map terrain, dodging bullets, and weapons strategically to kill other players.
- killing another player gives you a point on the score board, and the other player respawns after a small delay.
- when a player respawns they have a short period of invulnerability to avoid being killed immediately.
- the initial game mode should just be free for all.
- the game has rounds that are times to 3 minutes and the player with the highest score at the end of the round wins.
- users can join or leave rounds at any time. leaving and rejoining resets you score.
- try to keep the game fun to play, with funny animations, sound effects and quirks, and fun voice prompts when a player is killed.
- player names and current health bar should be visible to other players
- weapon ideas:
    - basic cannon that fires a projectile slowy in a straight line, dissappears on contact with terrain or player.
    - rocket that fires in straight line, explodes on contact causing area damage.
    - genade that can be thrown, bounces off terrain, cursor distance from the tank in the center determines force of the throw.
    - mortars that can fly over terrain.
    - lasers that fire instantly in a straight line and bounce 3 times.
    - cannon with bouncy bullets that fly in a straigh line and bounce 3 times.
    - machine gun that fires rapidly, but bulets do less damage.

Game architecture
- this game must be a client side only game that only needs static javascript to run.
- the javascript app must contain code for both hosting and joining a game.
- communication should be done p2p using webrtc, making use of libraries like peerJS.
- the host should contain the final source of truth, however clients can do optimistic calculations.
- there need not be a huge amount of errort to prevent people from cheating or manipulating the JS state, tis can be added later.
- the game will be hosted statically on github pages.
- when viviting the site the user should be able to host or join a game.
- when a game is hosted you get a link containing a join code.
- if you join a game the join code should be used to join the right game.
- do what you can to overcome common issues with webrtc and p2p discovery, but we cannot make a backend for this app. 
- make user of freely available resources you find online for images, sound, textures sprites etc.
- use high quality text to voice engines to make audio for the game, things like round start, round end, kill streaks etc.
- make high quality animations to make the game visually appealing and professional looking.
- the game should be fast and smooth, try to keep network communication fast for slower connections.
- keep track of things like ping on the UI.
- allow the user to set a name that gets saved in local storage.
- game maps should exist separate files that can be portable.

- make sure the sprites, textures and other assets are all similar visually so that the visual theme of the game is consistent.
- make sure the physics engine adds to the gameplay, the physics does not need to be completely realistic, but should be intuitive.

Credits
- Announcer voice lines generated with ElevenLabs (elevenlabs.io), free tier, non-commercial use.