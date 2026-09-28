# Smart TV Racer

Pixel-art racing game. Fake 3D camera, 2D physics.

The camera sits high behind the player car. You see the back of your car. If another car is very close, you can see its front bumper. A rear-view mirror sits at the top of the screen.

The 2D engine does not simulate real air resistance or wake drag. Drafting, smash, and slow-down are game rules, not physics.

Playable on a TV remote. Not designed only for a remote. Gamepad and keyboard must work too. Steering feel is the same on every device.

## Game modes

- Single player vs bots
- Local multiplayer, couch split-screen (needs extra controllers)
- Online racing

Field size changes by mode. Smaller online. Larger in single player.

## Controls

Always on:

- Steer left / right
- Brake
- Aggression

Acceleration is automatic. There is no throttle key. Brake is the only speed control: corners, draft gap, and smash defense.

Steering uses a fixed turn rate on all devices. Skill is when you press and release, not how far you push a stick.

Aggression changes the other buttons:

- Aggression + left or right = smash
- Aggression + brake = juke

While you smash, left and right are not steering. You are committed for a short time.

## Core loop

Cars have similar acceleration and top speed. Small speed gaps decide the race.

### Drafting

Sit behind another car. Both the leader and the follower gain speed. Keep the positions and the bonus grows in tiers. Longer draft = higher tier.

The leader can weave left and right to lose the tail. Weaving costs speed (you leave the straight path).

The follower can leave the draft to pass, using built-up speed. The pass is automatic: steer out of the slipstream. The extra speed fades fast, so timing still matters.

When the follower leaves, the leader loses the draft bonus and slows a little.

A drafting pair also gains on cars that are not in the draft.

### Smash

Smash only works on a car that is already beside you, not a car fully behind you.

On a successful smash, the hit car loses a lot of speed (into the roadside, another car, or an obstacle). The smasher gets a small speed boost.

If the follower predicts the smash and jukes, the smasher misses. On a narrow road the smasher hits a barrier and loses a lot of speed. On a wide road the smasher swings and still loses some speed. A successful juke also gives a small speed boost.

Smash has no durability / damage meter. Contact only changes speed. A missed smash must cost enough that players cannot spam it.

### Rear bumps

A rear bump helps the front car and hurts the back car.

If the hit is off-center, it also twists the front car off its line. A follower can punt on purpose: they lose speed, but they can ruin the leader's corner.

Brake-checking is a net loss. The leader's own brake costs more speed than the bump gives back.

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
- Close cars: front bumper visible in the main view
- Mirror: permanent strip at the top of the screen
- Mirror shows cars behind and smash wind-up. Whether it also shows draft tier is not decided yet.

Split-screen must still fit the mirror. Stacked views keep width. Side-by-side views are too narrow to read a car beside you.

## What is not in the game

- Manual throttle
- Durability / forced stop from accumulated damage
- Real aero simulation

## Open questions

- Draft cone size, lateral tolerance, tier times, and whether a third car in a train gets the same bonus
- Do draft tiers fade slowly or reset when alignment breaks
- Do corners push the car outward, and what happens if you enter too fast (run wide, spin, or clamp)
- Smash wind-up time, how much overlap is required, how long steering is locked
- Exact miss-smash penalty (and optional short cooldown)
- Does the leader see the follower's draft tier in the mirror
- Track authoring, obstacles, start procedure
- Bot skill (reaction time in the juke window, not fake extra speed)
- Online netcode
- Engine / platform (smart TV targets)
