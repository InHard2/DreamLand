# DreamLand

A browser voxel sandbox tribute to the classic Alpha era — pure HTML5/WebGL, no build step, no external assets (all textures, models, sounds and music are generated in code).

**Play:** serve the folder with any static server (e.g. `npx http-server .`) and open `index.html`, or host it on GitHub Pages. Works on desktop, phones/tablets (incl. iOS — use *Add to Home Screen* for fullscreen) and Xbox/standard gamepads (with rumble).

## Features
- Infinite terrain with caves, ores, biomes, trees, dungeons; worker-threaded generation and meshing
- Smooth lighting, day/night cycle, sunrise glow, sun/moon/stars, 3D clouds, fog
- Mining with crack stages, block placement, 2x2/3x3 crafting, chests, furnaces, farming, fluids, TNT
- Mobs with box-model rigs and A* pathfinding: pig, cow, sheep, chicken, zombie, skeleton, creeper, spider
- Title screen, world select/create, options, controls rebinding, loading screen, pause, death screen, chat + `/commands`
- Saves to IndexedDB (5 world slots)

## Dimensions & structures

- **The Nether**: build an obsidian frame (4x5 or larger) and light it with Flint and Steel or a Fire Charge. Netherrack caverns with lava seas, glowstone, quartz, soul sand, magma, nether fortresses (blaze spawners, nether wart), bastion remnants and ruined portals. Travel is scaled 1:8.
- **The End**: find a stronghold (throw an Eye of Ender, or `/locate stronghold`), fill the 12 End portal frames with Eyes of Ender and jump in. Fight the **Ender Dragon** (destroy the end crystals on the obsidian spikes first). Killing it opens the exit portal, drops the dragon egg and creates a gateway to the outer islands with **End cities**, shulkers and End ships (elytra!).
- **The Aether**: build a glowstone frame and light it with a water bucket. Floating islands of holystone and aether grass, skyroot and golden oak trees, aerclouds, ambrosium/zanite/gravitite ores, moas, phygs, flying cows, aerbunnies, sheepuffs, zephyrs, bronze dungeons (Slider boss) and silver temples. Fall off an island and you land back in the Overworld.
- **Overworld structures**: villages (houses, farms, smithies, libraries, churches, trading villagers, iron golems), desert temples, jungle temples, witch huts, igloos, pillager outposts, woodland mansions, desert wells, ruined portals, shipwrecks, ocean monuments (guardians), mineshafts, strongholds, fossils and buried treasure.
- **New creatures**: villager, witch, pillager, vindicator, iron golem, wolf (tame with bones), rabbit, slime, enderman, bat, polar bear, husk, stray, drowned, zombie pigman, piglin, wither skeleton, ghast, blaze, magma cube, shulker, endermite, silverfish, guardian, Ender Dragon and end crystals, plus the Aether mobs.
- **Commands**: `/dimension <overworld|nether|end|aether>`, `/locate <structure>`, `/summon <mob>`, `/give <item>`.

## Controls
WASD move · Space jump · Shift sneak · Mouse look · LMB break/attack · RMB place/use · 1-9/wheel hotbar · E inventory · Q drop · T chat · F5 camera · F3 debug · F2 screenshot. Touch and controller layouts are listed in *Help & Controls* in-game.
