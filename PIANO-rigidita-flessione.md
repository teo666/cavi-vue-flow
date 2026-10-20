# Piano: rigidità alla flessione nel motore `cavi`

Stato: implementato il 20 ottobre 2026, non committato né pubblicato (vedi "Passi"). Valori scelti
provando la demo: rigidità 0,3 con 4 iterazioni. Tocca tre repo: `../cavi` (motore Rust/WASM), `../cavijs` (wrapper TypeScript),
`cavi-vue-flow` (questo).

## Perché

I cavi di `cavi` sono catene di maglie: ogni sotto-passo integra i nodi e poi chiama
`relax_links()` (`src/world/wire.rs`) `constraint_iterations` volte, riportando ogni coppia di nodi
vicini a `link_target_distance`. Niente si oppone alla piegatura, quindi:

- un cavo appeso a un handle scende dritto come un filo a piombo e si curva solo dove la corda
  finisce (il "pezzo dritto" nella demo Vue Flow);
- un capo è un punto senza orientamento: il cavo può arrivare all'handle da qualunque lato, anche
  da dietro il box.

Gli "steli" (nodi fissati accanto ai capi) e le tangenti solo nel disegno sono già stati provati e
scartati: un nodo fisso lascia un tratto dritto e uno spigolo.

## Soluzione

### 1. Vincolo di curvatura (per cavo, `bend_stiffness` in [0, 1], default 0)

Per ogni terna di nodi consecutivi `a, b, c`, dopo `relax_links()` e dentro ogni iterazione:

```rust
let c = a + cc - b * 2.0;            // curvatura: zero se b è il punto medio di a e c
let s = wa + wc + 4.0 * wb;          // w = massa inversa: 1 libero, 0 fisso; s == 0 → salta
let k = self.bend_stiffness / s;
a  -= c * (k * wa);
cc -= c * (k * wc);
b  += c * (2.0 * k * wb);
```

- Agisce solo sulla piegatura, non sulla lunghezza dei link.
- I nodi fissi non si muovono mai (`w = 0`), senza casi speciali.
- Non dipende dalla scala: stesso effetto quando il cavo cresce o si accorcia (`growTo`/`shrinkTo`).
- Default 0: i cavi esistenti restano identici.
- Con `n` iterazioni la rigidità effettiva è circa `1 − (1 − k)^n`: da documentare.

### 2. Direzione dei capi (per capo, facoltativa)

Un nodo virtuale fisso dietro il capo, a `p0 − d·L` (`d` = direzione dell'handle, `L` =
`link_target_distance`), e lo stesso vincolo sulla terna `(virtuale, p0, p1)`. Virtuale e `p0`
sono fissi: si muove solo `p1`, tirato verso `p0 + d·L` con forza `k`. È uno stelo morbido: il cavo
esce dall'handle nella direzione giusta e curva gradualmente. Senza direzione, nessun nodo virtuale.

## API

| Livello              | Cosa                                                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cavi` (`WasmWorld`) | `set_wire_bend_stiffness(idx, k)`, `get_wire_bend_stiffness(idx)`, `set_wire_end_direction(idx, end, dx, dy)` (`(0, 0)` la toglie), `get_wire_end_direction_x/y(idx, end)`. Ogni modifica sveglia il cavo (`invalidate`). |
| cavijs (`Wire`)      | `setBendStiffness(k)`, `getBendStiffness()`, `setEndDirection(0 \| 1, { x, y } \| null)`, `getEndDirection(end)`. Forse un attributo `bend` su `<cavi-wire>`. Esportati anche da `cavijs/core`.                           |
| cavi-vue-flow        | `CableStyle.bendStiffness` (default da regolare, circa 0,3); la direzione di ogni capo dalla `Position` dell'handle (`directionOf`, da rimettere); la connection line solo sul capo di partenza.                          |

## Passi

1. **`../cavi`**, branch `feat/bend-stiffness` da `main` (serve l'accesso alla cartella):
   - campi `bend_stiffness` e `end_directions: [Option<WasmPoint>; 2]` in `WasmWire`, copiati da
     `Clone`, mantenuti da `set_node_count`/`add_node_at`/`remove_node`;
   - `relax_bends()` chiamata dopo `relax_links()` in `update_with_iterations`;
   - API su `WasmWorld`, con `invalidate` del cavo;
   - test (sotto); `cargo test`, `wasm-pack build --target web`.
2. **`../cavijs`**, branch da `feat/core-entry` (o da `dev` se nel frattempo è stato unito):
   - `cavi` collegato in locale (`link:../cavi/pkg`) solo per provare;
   - metodi su `Wire`, export, documentazione EN/IT (`03-api`), test con il motore vero;
   - nessun cambio di comportamento con i default (test unitari ed e2e invariati).
3. **cavi-vue-flow**: `bendStiffness` in `CableStyle`, direzioni dagli handle in `CaviEdge` e
   `CaviConnectionLine`, valori regolati guardando la demo (handle ai lati e in alto/basso),
   README.
4. **Rilascio** (lo fa Teo): pubblicare `cavi` 0.3.0 su npm, cavijs da `link:` a `^0.3.0`.

## Test nel motore

- `bend_stiffness = 0`: comportamento invariato (tutti i test esistenti passano).
- Un cavo piegato, senza gravità né capi fissi oltre gli estremi, si raddrizza nel tempo.
- I nodi fissi non si muovono mai, nemmeno con `k = 1`.
- Con una direzione sul capo 0, il nodo 1 va verso `p0 + d·L`.
- Un cavo orizzontale con gravità pende meno quando `k` cresce.
- Cambiare rigidità o direzione sveglia un cavo addormentato.
- `set_node_count` / `add_node_at` / `remove_node` mantengono rigidità e direzioni.

## Da verificare / domande aperte

- Stabilità con `k` vicino a 1 e molte iterazioni (oscillazioni?), insieme a collisioni e mouse.
- Il cavo tenuto (`held_wire`): la direzione del capo libero va ignorata mentre lo trascini.
- Valore di default per Vue Flow e se esporlo anche per i cavi dei jack in cavijs
  (un `<cavi-jack>` potrebbe dare la direzione dei suoi plug).
