# TODO

## Performance (measure on `/stress`)

- [ ] Draw cables without Vue on every frame: write the `<path>`'s `d` attribute directly, or
      draw every cable on one canvas under/over Vue Flow. Measured with 999 cables all swinging:
      Vue's update of the edges takes about 2.6 ms a frame, the cables' tick 0.7 ms, and the page
      keeps the display's refresh rate — worth it on slower machines, not needed yet. Replacing
      BaseEdge would lose labels and markers.
- [x] Put the cables to sleep at rest: the frame loop rests once every cable sleeps and wakes on
      the next change (CableWorld.wake).
- [ ] Skip simulating and drawing cables off screen (culling).
- [x] Stress page: the cables' milliseconds a frame, awake cables, whether the loop runs.
- [ ] Stress page: the browser's own drawing time, apart (needs the Long Animation Frames API or a
      trace).

## Patchbay

- [ ] A new cable out of an occupied jack: a modifier (Alt+drag pulls a new cable, a plain drag
      moves the plug) — today pressing an occupied jack grabs its plug.
- [ ] A connection line dropped on no handle vanishes: let it fall with gravity and fade, or
      retract.
- [ ] Several plugs on one jack: stacked or fanned out, like stackable patch plugs.
- [ ] Fixed cable lengths from the handle (short / medium / long), as thickness is
      (`handleCable`); a cable stretched too far unplugs or pulls its module.

## Physics and rendering

- [ ] Cables going around the boxes instead of over them (collisions in the `cavi` engine, if it
      has them or once they are added).
- [ ] Highlight a cable on hover; a "signal flowing" effect along a cable.
- [ ] Undo/redo putting back the cables' shapes too, not only the connections (cavijs already
      saves and restores them).

## Library

- [ ] Build as a library: `.d.ts`, `exports` in package.json, `vue` and `@vue-flow/core` as peer
      dependencies.
- [ ] Publish (cavijs 0.1.0 and cavi 0.3.0, which it needs, are on npm).
- [x] End-to-end tests with Playwright on the demos (`pnpm test:e2e`): connect, move a plug,
      unplug, sizes and types refused, undo/redo, the loop resting and waking.
- [ ] Run them in CI (GitHub Actions), with the unit tests and the typecheck.
- [ ] A cable hanging across a handle of a third node still takes its presses (CaviEdge clears
      only the handles of its own two nodes).
- [ ] Demo on GitHub Pages.
- [ ] Touch support, checked on mobile.
