# TODO

## Performance (measure on `/stress`)

- [ ] Draw cables without Vue on every frame: write the `<path>`'s `d` attribute directly, or
      draw every cable on one canvas under/over Vue Flow — today every cable updates a ref and
      Vue diffs every path every frame.
- [ ] Put the cables to sleep at rest: stop the animation loop when nothing moves, start it again
      on the first interaction (zero CPU while idle).
- [ ] Skip simulating and drawing cables off screen (culling).
- [ ] Stress page: physics milliseconds and render milliseconds shown apart.

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
- [ ] End-to-end tests with Playwright on the demos (connect, move a plug, unplug, undo).
- [ ] Demo on GitHub Pages.
- [ ] Touch support, checked on mobile.
