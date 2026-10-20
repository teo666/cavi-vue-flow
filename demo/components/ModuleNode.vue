<script setup lang="ts">
import { Handle, Position, type NodeProps } from '@vue-flow/core';

/** A jack's size: only jacks of the same size connect, and it sets the cable's thickness. */
export type JackSize = 'mini' | 'large';

/** A jack on a module's panel: a Vue Flow handle drawn as a socket. */
export interface Jack {
  id: string;
  label: string;
  /** Only jacks of the same type connect. */
  type: 'audio' | 'cv';
  size: JackSize;
  /** Most cables plugged in at once (default: any number). */
  max?: number;
}

export interface ModuleData {
  title: string;
  jacks: Jack[];
}

/**
 * A synth module: a panel with its jacks inside the box, not on its border.
 * Every jack is a plain Vue Flow `<Handle>` — Vue Flow does the connecting,
 * the limits (`connectable`) and the validation; the cables only draw and
 * simulate (CaviEdge with `anchor: 'center'`, plugging into the socket).
 * All handles are sources: in the default loose connection mode any jack
 * connects to any other, as patch cables have no direction.
 *
 * The handle itself is a 2px point at the socket's center, the socket drawn
 * around it as its child: Vue Flow measures only the handle, so its own
 * point for the edge — where it puts the grips to pull a plug out
 * (updatable edges) — is the socket's center, under the plug; pressing
 * anywhere on the socket still reaches the handle.
 */
defineProps<NodeProps<ModuleData>>();
</script>

<template>
  <div class="module">
    <div class="module-title">{{ data.title }}</div>
    <div class="module-jacks">
      <div v-for="jack in data.jacks" :key="jack.id" class="jack-cell">
        <div class="jack-slot">
          <Handle
            :id="jack.id"
            type="source"
            :position="Position.Top"
            class="jack"
            :class="[`jack-${jack.type}`, `jack-${jack.size}`]"
            :connectable="jack.max ?? true"
          >
            <span class="jack-socket" />
          </Handle>
        </div>
        <span class="jack-label">{{ jack.label }}</span>
      </div>
    </div>
  </div>
</template>

<style>
.vue-flow__node-module {
  padding: 0;
  border: none;
  background: transparent;
}
.module {
  min-width: 150px;
  background: #262626;
  border: 1px solid #444;
  border-radius: 6px;
  box-shadow: 0 2px 8px #0008;
}
.module-title {
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #ccc;
  border-bottom: 1px solid #383838;
}
.module-jacks {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px 10px;
  padding: 12px 10px 10px;
}
.jack-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}
.jack-slot {
  position: relative;
  width: 22px;
  height: 22px;
}
/* The handle: a point at the socket's center, inside the panel. */
.vue-flow__handle.jack {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 2px;
  min-width: 0;
  min-height: 0;
  transform: translate(-50%, -50%);
  border: none;
  background: transparent;
}
.jack-socket {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 16px;
  height: 16px;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
  border-radius: 50%;
  background: #080808;
  border: 3px solid #777;
  cursor: crosshair;
}
.jack-large .jack-socket {
  width: 22px;
  height: 22px;
  border-width: 4px;
}
.jack-audio .jack-socket {
  border-color: #3fc6d8;
}
.jack-cv .jack-socket {
  border-color: #f2c94c;
}
.vue-flow__handle.jack.valid .jack-socket {
  box-shadow: 0 0 0 3px #fff6;
}
.jack-label {
  font-size: 10px;
  color: #999;
  text-transform: uppercase;
}
</style>
