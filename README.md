# Glory Eleven

An original club-building football game that runs in the browser. Start in Division 3 with a squad of hopefuls, win matches, earn coins, sign better players at auction and climb to the Elite Division.

All clubs and players are fictional.

## Play

Open `index.html` in Chrome or Edge. There is nothing to install or build.

To serve it locally instead:

```
python -m http.server 8080
```

then visit http://localhost:8080/.

## Features

- 11 v 11 matches under floodlights with a broadcast-style camera, drawn on a 2D canvas
- Passing, lobs, power shots with aiming, sprinting, player switching and slide tackles
- Throw-ins, corners, goal kicks, the woodwork and diving goalkeepers
- Career mode: 8-team leagues across four divisions with promotion, relegation and prize money
- Squad management with a 4-3-3 line-up and player training
- Live player auctions against rival clubs
- Star ratings and a top-scorers table
- Progress saved in the browser
- Touch controls on phones and tablets

## Controls

| Action | Keyboard |
| --- | --- |
| Move | `W` `A` `S` `D` or arrow keys |
| Pass / switch player | `J` |
| Shoot / slide tackle (hold for power) | `K` or `Space` |
| Lob | `L` |
| Sprint | `Shift` |
| Pause | `Esc` |

On touch screens an on-screen stick and buttons appear.

## Code

Plain HTML, CSS and JavaScript with no dependencies.

- `js/data.js` — clubs, players, league, auction market and saving
- `js/match.js` — match simulation and AI
- `js/render.js` — stadium and player rendering
- `js/ui.js` — menus, input, audio and the main loop
