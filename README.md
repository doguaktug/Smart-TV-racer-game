# Smart TV Racer

Pixel-art racing game. Fake 3D camera, 2D physics.

The camera sits high behind the player car. You see the back of your car. If another car is very close, you can see its front bumper. A rear-view mirror sits at the top of the screen.

The 2D engine does not simulate real air resistance or wake drag. Drafting, smash, and slow-down are game rules, not physics.

Playable on a TV remote. Not designed only for a remote. Gamepad and keyboard must work too. Steering feel is the same on every device.

## Game modes

- Single player vs bots
- Local multiplayer, couch split-screen (needs extra controllers)
- Online racing


## Controls

- Steer left / right
- Brake
- Aggression

Acceleration is automatic. There is no throttle key. Brake is the only speed control: corners, draft gap, and smash defense.

Steering uses a fixed turn rate on all devices. Skill is when you press and release, not how far you push a stick.

Aggression changes the other buttons:

- Aggression + left or right = smash
- Aggression + brake = juke

While you smash, left and right are not steering. You are committed for a short time.

Since most TV remotes don't support double inputs if an action is taken within 300ms after the aggression button is pressed it is passed as a combo as well.

## Core loop

Cars have similar acceleration and top speed. Small speed gaps decide the race.

### Drafting

Cars are 2 m wide and 4.5 m long.

Sit behind another car. Two limits:

- Along the track: at most 3 m from your front bumper to their rear bumper.
- Side to side: less than 1.5 m between the two cars' centre lines. Cars are 2 m wide, so at least 0.5 m of the cars overlap.

Hold it for 2 seconds and the two cars lock in as a drafting pair.

Both the leader and the follower gain top speed. Keep the positions and the bonus grows in tiers. Longer draft = higher tier. Can be indicated by: small red flames from tires/under the cars lvl1 - green fire lowkey surrounding the cars lvl2 - blue flames surrounding the cars lvl3

A drafting pair also gains on cars that are not in the draft.

The pair breaks when the follower drifts out past the limits. There is a 0.1 m margin on the break (3.1 m bumper to bumper, 1.6 m between centre lines), so a pair does not flicker in and out.

When the pair breaks, both cars start to lose the extra speed from the draft.

The leader can weave left and right to lose the tail. Weaving costs speed (because by leaving the straight path geometrically you are traveling a longer distance with the same velocity).

To pass, the follower steers out and pulls up tight beside the leader: 2–2.5 m between centre lines (at most 0.5 m of space between the cars' sides), with the bumpers 0.3 m or closer along the track. While it presses there, the leader gets extra deceleration. This lasts until the two cars are side by side (centres level). Only the car that was drafting that leader can do this, and it has to stay close (within 3.1 m bumper to bumper, less than 2.5 m between centre lines) after leaving the draft or it loses the chance.

### Smash

Smash only works on a car that is already beside you, not a car fully behind you.

On a successful smash, the hit car loses a lot of speed (into the roadside, another car, or an obstacle). The smasher gets a small speed boost.

If the follower predicts the smash and jukes, the smasher misses. On a narrow road the smasher hits a barrier and loses a lot of speed. On a wide road the smasher swings and still loses some speed. A successful juke also gives a small speed boost.

Smash has no durability / damage meter. Contact only changes speed. A missed smash must cost enough that players cannot spam it (although there is a cooldown).

### Rear bumps

A rear bump helps the front car and hurts the back car. The car in front can also juke the bump (example: when the leader might have slowed down significantly for a very hard turn and the follower might be coming in hot to mess up the leaders angle)

If the hit is off-center, it also pushes the front car off its line (by little). A follower can punt on purpose: they lose speed, but they can ruin the leader's corner.

Brake-checking is a net loss. The leader's own brake costs more speed than the bump gives back. Also the follower can juke a break check just like a smash.

### Corners and racing line

Brake is also needed in corners. The racing line has a turn-in, an apex, and an exit.

The leader can keep the lead without a guaranteed win:

- Smash cars that try to pass (those cars are often drafting, so both were already faster than the pack)
- Take a better racing line than the rest
- Avoid obstacles with less extra distance

The leader can also take a defensive line: occupy the inside, close the door, go slower. The fast line is quicker but leaves the inside open.

The road has continuous side-to-side position. You can sit anywhere across the width, not only in fixed lanes. This is required for apex skill.

If drafting on long straights gives more time than a good racing line, the leader cannot defend. Tracks must mix straights and corners on purpose.

## Camera and HUD

- Main view: high behind the car (fake 3D)
- Close cars: front bumper visible in the main view (when very close for example when in the draft together)
- Mirror: permanent strip at the top of the screen
- Mirror shows cars behind and smash wind-up.

Split-screen must still fit the mirror. Stacked views keep width. Side-by-side views are too narrow to read a car beside you.

## What is not in the game

- Manual throttle
- Durability / forced stop from accumulated damage
- Real aero simulation
