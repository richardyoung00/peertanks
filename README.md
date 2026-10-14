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
    - genade that can be thrown, bounces off terrain, distance thrown is determined by how long you hold the mouse button down. Max of 3 seconds throws it furthest disance.
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
- when users leave or become unresponsive due to technical or network issues we should handle that and pick it up early.
- when you are in a game all users should be able to copy a link have have the invite code visible.
- also update the join hash in the url so that you can copy and paste from the URL bar. 


Powerups
- weapons and powerups should spawn at predefined spots on the map after a configrable amount of time. The map should be able to specify if the spot randomly chooses from all available weapons/powerups, or randomly chooses from a subset. 
- powerups are things that temporarily modify the player for a short time, eg
    - shield: reduced damage taken for 20 seconds
    - speedup movement for a short time
    - increased damage for a short time
    - explode on death, causing splash damage

Configuration
- there should be a global gameplay config file. This file can be read at compile time, it doesnt need to be dynamic. It should contain all the metrics that can be changed to balance gameplay, such as the speed and damage of each weapon, splash radius and splash damage of each weapon, movement speed, respawn time, any metrics associated with powerups, default round time etc. 

AI Bots
- there should be AI bots that can be added to a round. They can be added either before a round start, or added/removed from the hosts in game menu. Look up some strageties for how these AI bots can function so that they play like human players. Determine some parameters that will influence their skill level and playing style, and allow these to be randomised within certain limits to create different personalities. The host should be able to add easy, medium or hard bots. The bounds for the skill parameters should be changable in the config file so we can tweak it.   

Game menu
- The host game menu should allow the host to choose a map, as well as what weapons and powerups are allowed in the map. The list of weapons should filter what spawns on the map.
- The host can also add bots from this menu.
- While in this menu the join link should already be available to that people can join, and be visible in the lobby before the game starts, however people can join mid game as well.
- the host can change the default round length here ass well.
- once a game has started the host should have a game menu that allows certain game settings to be changed. They should be able to kick people (including bots) and add new bots at varying difficulty levels.
- the game menu should be different for people who are not the host. It should perhaps just have a leave game button.

Game score
- The current game score should be visible in the top corner showing who all is in the round (including bots) and their kill/death ratio and any kill streak. 

Credits
- No third-party assets yet. Assets are chosen to be royalty- and attribution-free; see docs/PLAN.md (Audio and assets).