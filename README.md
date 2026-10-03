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

## Survival like modern Minecraft
- **Hunger and saturation**: eating restores both, sprinting and fighting burn them, a full bar heals you and an empty one hurts. Golden apples give regeneration and absorption.
- **Swimming**: sprint in water to swim flat and fast (with the swimming pose for everyone watching).
- **Horses**: tame one by riding it with an empty hand until it hearts, or right-click a wild horse holding a **saddle** to put it on and mount straight away. Sneak to get off.
- **Resource packs**: *Options > Resource Packs* (or drop a .zip on the game) loads any Minecraft Java pack, 16x to 64x. Packs only change pictures.

## The Sift
The dimension revealed at Minecraft Live: build a **crying obsidian** frame and light it with an **echo shard**. Pastel floating islands over a sea of iridescent ichor, red sculk meadows, the Carapace's giant fossils, Echo Dens, the Sift Tides and their creatures.

## Villages and castles
- **Villages** are now towns: winding streets, a central plaza with a well or bell, market stalls, farms, smithies, libraries, churches, taverns, barracks, watchtowers and a palisade, in plains, desert, savanna, taiga and snowy styles. Dozens of villagers live there.
- **Giant castles** stand on hills: curtain walls with towers and wall-walks, a gatehouse with a portcullis, a courtyard, a great hall, a keep, dungeons with spawners and treasure. Some are ruined. `/locate castle` finds one.

## OreSpawn
DreamLand's own take on the classic OreSpawn mod, drawn and voiced from scratch:
- **Ores and materials**: uranium, titanium, amethyst, ruby, Mobzilla scales and more, with tools, weapons (Big Bertha, Royal Guardian sword, battle axe, Queen's Battle Axe, chainsaw, ray gun, squid zooka) and 14 armour sets with powers.
- **Food and crops**: strawberries, tomatoes, corn, lettuce, quinoa, radishes, rice, butter, cherry and peach trees, crystal apples, and the fancy dishes.
- **The giants**: The King (three heads: fire, ice and lightning), The Queen, Pitch Black, Mobzilla (atomic breath), the Kraken, Mothra, Robo-Jeffery, the CaterKiller (it eats trees), the Vortex and the Sea Viper, each with a boss bar and a guaranteed trophy that finishes Big Bertha and the Royal Guardian gear. Wear the whole Royal Guardian set and The King and Queen leave you alone. The Queen drops **The Prince Egg**: hatch it, feed it meat, and after three days fly it.
- **3D gear**: Big Bertha, the Royal Guardian Sword, the battle axes, hammers, chainsaw and guns are real 3D models in your hand, and every armour set looks like what it is made of (crowns, capes, horns, plumes, spikes, wings, gems).
- **83 creatures**: dinosaurs (T. rex, alosaurus, velocity raptors, cryolophosaurus, baryonyx, camarasaurus, basilisk...), dragons, Spyro, water dragons, cloud sharks, the leonopteryx, giant bugs (mantises, stink bugs, Hercules beetles, emperor scorpions), sea monsters, whales, ghosts, Ender knights and reapers, triffids, worms, urchins and many cute critters. Tame Spyro, the baryonyx or the camarasaurus with food, ride the camarasaurus or an ostrich, and find every one's spawn egg in the **OreSpawn** creative tab.

## Building and crafting
- **Every wood and stone**: doors, stairs, slabs and fences come in every wood (oak, spruce, birch, jungle, acacia, dark oak, mangrove, cherry, pale oak, skyroot, crystal, sift), and stairs and slabs in 16 stones (stone, mossy cobblestone, deepslate, blackstone, prismarine, end stone bricks...). Any planks, logs or cobble-like stone work in the everyday recipes, even mixed.
- **Beds**: three wool on three planks (red, white or blue). Sleep at night or in a thunderstorm to skip to morning and wake up there after dying. Not with monsters nearby, and never in the Nether or the End.
- **Inventory tricks** (like Minecraft): hold a stack and sweep across slots to spread it (left button: evenly, right button: one each); double-click to gather; shift-click, shift-double-click and shift-drag to move stacks; wheel over a stack to move one item; 1-9 to swap with the hotbar; Q / Ctrl+Q to drop; shift-click a result to craft as many as you can. Touch: hold a stack and slide a finger; controller: hold A or X and steer. All of it is on the *Inventory* page of Help & Controls.

## Controller not working?
The title screen shows the controller's state in the bottom-left corner, with what to do:
1. Click the game once, then press **A**. Browsers only show a controller to a page after a button press.
2. Open the game at **http://localhost:8080** (the address *Start DreamLand Server.bat* opens) or the downloaded `index.html`, not at a `192.168...` address: browsers block controllers on those.
3. Use Edge or Chrome. If the game runs inside another app's window, open it in a browser tab instead.
4. Close Steam / DS4Windows if they are running (they can take the controller over), or plug the controller in with a cable.
5. *Options > Touch & Controller > Controller Test* shows every button live and lets you remap them.

## Updating your copy (no more zips)
Run **Update DreamLand.bat** (Windows) or `./update.sh` (Mac/Linux) in the DreamLand folder. It needs [Git](https://git-scm.com/downloads); the first run links the folder to GitHub, every later run downloads only what changed. Your worlds are kept because they live in your browser. Reload the game page afterwards (Ctrl+F5).

From **Visual Studio Code**: open the DreamLand folder, open *Terminal > New Terminal* and type `git pull` (or `.\"Update DreamLand.bat"` if you started from a zip). To get a fresh copy instead of a zip: `git clone https://github.com/InHard2/DreamLand.git`.

## Playing on several computers (LAN server)
Downloaded copies have no Claude lobby, so DreamLand ships a tiny server that runs the lobby and carries the game traffic. It needs **Node.js** or **Python 3** (no packages).
1. On one PC, extract the zip and double-click **Start DreamLand Server.bat** (Windows), or run `./start-server.sh` (Mac/Linux), `node server.js` or `python server.py`. When Windows asks, click **Allow access**.
2. The window shows addresses such as `http://192.168.1.23:8080`. The game opens on that PC; everyone else on the same Wi-Fi opens that address in their browser.
3. The host picks **Pause > Open to Wi-Fi**. Friends pick **Multiplayer**, see the world in the list, type the 4-digit code and join.

The server only passes messages along; the host still checks the code and every action. Without the server you can still try **invite codes** (Multiplayer > Join with an invite code / Pause > Invite by code); send the reply code back within about a minute.

## Controls
WASD move · double-tap W or R sprint · Space jump · Shift sneak · Mouse look · LMB break/attack · RMB place/use · 1-9/wheel hotbar · E inventory · Q drop · T chat · M minimap · F5 camera · F3 debug · F2 screenshot. Sprint on touch by pushing the stick past its ring, on a controller by clicking the left stick. Touch and controller layouts are listed in *Help & Controls* in-game.
