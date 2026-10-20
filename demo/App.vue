<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';

/** The demo's routes, as the side menu lists them. */
const ROUTES = [
  { to: '/', title: 'Connection line', hint: "Vue Flow's example, with cables" },
  { to: '/patchbay', title: 'Patchbay', hint: 'Jacks, plugs, undo/redo' },
  { to: '/stress', title: 'Stress test', hint: 'Up to 1000 boxes' },
];
</script>

<template>
  <div class="shell">
    <nav class="routes" aria-label="Demos">
      <div class="brand">cavi-vue-flow</div>
      <RouterLink v-for="route in ROUTES" :key="route.to" :to="route.to" class="route">
        <span class="route-title">{{ route.title }}</span>
        <span class="route-hint">{{ route.hint }}</span>
      </RouterLink>
      <div class="links">
        <a href="https://github.com/teo666/cavi-vue-flow">GitHub</a>
        <a href="https://www.npmjs.com/package/cavijs">cavijs</a>
      </div>
    </nav>
    <RouterView class="view" />
  </div>
</template>

<style>
html,
body,
#app {
  margin: 0;
  height: 100%;
  background: #181818;
  color: #ddd;
  font-family: 'Helvetica Neue', Arial, sans-serif;
}
.shell {
  display: flex;
  height: 100%;
}
/* The side menu: the demo's routes, one under the other. */
.routes {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 200px;
  padding: 16px 10px;
  box-sizing: border-box;
  border-right: 1px solid #2c2c2c;
  background: #141414;
  font-size: 13px;
}
.brand {
  padding: 0 10px 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #9fd8e0;
}
.route {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-left: 2px solid transparent;
  border-radius: 0 4px 4px 0;
  color: #bbb;
  text-decoration: none;
}
.route:hover {
  background: #1e1e1e;
}
.route.router-link-exact-active {
  border-left-color: #9fd8e0;
  background: #202424;
  color: #fff;
}
.route-hint {
  font-size: 11px;
  color: #777;
}
.links {
  display: flex;
  gap: 12px;
  margin-top: auto;
  padding: 10px 10px 0;
  font-size: 12px;
}
.links a {
  color: #777;
  text-decoration: none;
}
.links a:hover {
  color: #9fd8e0;
}
.view {
  flex: 1;
  min-width: 0;
  min-height: 0;
}
/* Narrow screens: the menu goes back above the page, in a row. */
@media (max-width: 720px) {
  .shell {
    flex-direction: column;
  }
  .routes {
    flex-direction: row;
    align-items: center;
    width: auto;
    padding: 6px 10px;
    border-right: none;
    border-bottom: 1px solid #2c2c2c;
    overflow-x: auto;
  }
  .brand,
  .route-hint,
  .links {
    display: none;
  }
  .route {
    border-left: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    white-space: nowrap;
  }
  .route.router-link-exact-active {
    border-bottom-color: #9fd8e0;
  }
}
header {
  padding: 16px 20px 0;
}
h1 {
  font-size: 16px;
  margin: 0 0 4px;
}
p {
  max-width: 680px;
  color: #999;
  font-size: 13px;
  line-height: 1.5;
  margin: 0 0 12px;
}
code {
  color: #9fd8e0;
}
.vue-flow__node {
  background: #2a2a2a;
  color: #ddd;
  border-color: #555;
}
.vue-flow__edge.selected .vue-flow__edge-path {
  filter: drop-shadow(0 0 4px #fff8);
}
</style>
