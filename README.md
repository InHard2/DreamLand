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

## Controls
WASD move · Space jump · Shift sneak · Mouse look · LMB break/attack · RMB place/use · 1-9/wheel hotbar · E inventory · Q drop · T chat · F5 camera · F3 debug · F2 screenshot. Touch and controller layouts are listed in *Help & Controls* in-game.
