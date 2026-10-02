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

## Multiplayer (same Wi-Fi)

- **Host:** open your world, press Pause and choose **Open to Wi-Fi**. You get a 4-digit join code.
- **Friends:** on the title screen choose **Multiplayer**, pick the game and type the code.
- Everyone must be on the same Wi-Fi network: the connection is a direct, encrypted WebRTC link that only accepts local-network addresses (no internet relay servers).
- Games are discovered through the artifact page's live room, so friends need access to the same DreamLand artifact.
- The host's world is the authority: every guest action is validated, range-checked and rate-limited; only the host can run commands and take everyone through portals.

**Playing with a downloaded copy (or any other browser)?** Use invite codes, no lobby needed:
1. The guest taps **Multiplayer > Join with an invite code** and sends the `DL1-...` code to the host (any chat app).
2. The host pastes it in **Pause > Invite by code** and sends the `DL2-...` reply code back.
3. The guest pastes the reply and is in. Both devices still have to be on the same Wi-Fi.

## Portal Gun

- Craft it (glowstone dust on top, iron ingots around an ender pearl, obsidian at the bottom) or grab it from the Creative inventory.
- **Use** (right click / tap / LT) fires a **blue** portal, **attack** (left click / hold / RT) fires an **orange** one, **sneak + use** closes both.
- Portals go on solid blocks: 1x2 on walls, 1x1 on floors and ceilings. Walk, fall or throw things in: players, mobs, items and arrows come out of the other portal with their speed rotated to match.
- Wall portals show a live view of the other side.

## Weather, fireworks & more
- **Weather**: rain, snow (tundra / high peaks) and thunderstorms. Lightning sets fires, turns pigs into zombie pigmen, villagers into witches and charges creepers (bigger boom!). `/weather <clear|rain|thunder>`.
- **Fireworks**: craft paper + gunpowder -> 3 rockets. Nine burst shapes (star, heart, creeper face, smiley, ring, willow...), twinkles, and rockets boost you while gliding with an elytra. `/fireworks` starts a show.
- **Grappling hook**: stick, string and an iron ingot. Use it to zip to blocks or yank mobs towards you; use again to let go.
- **Dynamic lights**: holding a torch, glowstone, lava bucket etc. lights up the world around you.
- **Night sky**: shooting stars (make a wish!) and auroras over snowy biomes.
- **Achievements**: 25 of them, with toasts. Browse them from the pause menu.

## Modern biomes
Over 40 biomes from today's Minecraft: cherry groves, mangrove swamps, badlands (with eroded spires and wooded plateaus), savannas, jungles and bamboo jungles, dark forests, the pale garden, birch and old growth forests, taigas and giant spruce, meadows, groves, snowy slopes, frozen/jagged/stony peaks, ice spikes, mushroom fields, flower forests, sunflower plains, rivers, beaches and warm, deep and frozen oceans with icebergs. Underground you can find lush caves, dripstone caves and the deep dark. Each biome has its own blocks, trees, plants and animals (mooshrooms included), and villages take on spruce or acacia styles. Press F3 to see which biome you are in.

## Creative inventory
Tabs like modern Minecraft: Building, Colored, Natural, Functional and Redstone blocks, Tools, Combat, Food, Ingredients, Spawn Eggs (every mob), Search and the Survival Inventory. The **World & Weather** tab sets the time, toggles flying and has **Rain: ON/OFF** to keep the sky clear for good.

## The Wishlist update (things Mojang should have added)
- **The mob-vote losers, finally here:** the **Glare** floats around lush caves and turns grumpy (red eyes, smoke) where it's dark enough for monsters to spawn; the **Moobloom** (flower cow) leaves buttercups behind; **Penguins** waddle on snowy shores, belly-slide on ice and swim fast; **Crabs** scuttle sideways in mangroves and on beaches and drop **crab claws** (keep one in your hotbar for +3 reach); the **Iceologer** haunts snowy mountains and drops chunks of ice on you.
- **Fireflies** glow at night in swamps, forests, meadows and cherry groves, and **leaves (and cherry petals) drift down** from the trees.
- **Horses** in plains, savannas and meadows: right-click with an empty hand to ride, put on a **saddle** to steer (sprint to gallop, jump to leap), sneak to get off. Saddles are craftable: 3 leather on top, leather-iron-leather below.
- **Chairs:** right-click a stair with an empty hand to sit down.
- **Biome colours:** grass, leaves and water change colour with the biome (dark swamps, golden savannas, bright jungles, turquoise warm oceans).
- **Minimap** with coordinates and the biome name (M to toggle, or Options), **death coordinates** in chat, and a **Sort** button in your inventory and chests.
- The creative inventory's Survival Inventory tab now shows your 3D character, and there are spawn eggs for all the new creatures.

## Playing on several computers (LAN server)
Downloaded copies have no Claude lobby, so DreamLand ships a tiny server that runs the lobby and carries the game traffic. It needs **Node.js** or **Python 3** (no packages).
1. On one PC, extract the zip and double-click **Start DreamLand Server.bat** (Windows), or run `./start-server.sh` (Mac/Linux), `node server.js` or `python server.py`. When Windows asks, click **Allow access**.
2. The window shows addresses such as `http://192.168.1.23:8080`. The game opens on that PC; everyone else on the same Wi-Fi opens that address in their browser.
3. The host picks **Pause > Open to Wi-Fi**. Friends pick **Multiplayer**, see the world in the list, type the 4-digit code and join.

The server only passes messages along; the host still checks the code and every action. Without the server you can still try **invite codes** (Multiplayer > Join with an invite code / Pause > Invite by code); send the reply code back within about a minute.

## Controls
WASD move · double-tap W or R sprint · Space jump · Shift sneak · Mouse look · LMB break/attack · RMB place/use · 1-9/wheel hotbar · E inventory · Q drop · T chat · M minimap · F5 camera · F3 debug · F2 screenshot. Sprint on touch by pushing the stick past its ring, on a controller by clicking the left stick. Touch and controller layouts are listed in *Help & Controls* in-game.
