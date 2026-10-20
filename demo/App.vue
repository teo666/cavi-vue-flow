<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <div class="shell">
    <nav class="routes">
      <RouterLink to="/">Connection line</RouterLink>
      <RouterLink to="/patchbay">Patchbay</RouterLink>
      <RouterLink to="/stress">Stress test</RouterLink>
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
  flex-direction: column;
  height: 100%;
}
.routes {
  display: flex;
  gap: 16px;
  padding: 10px 20px;
  border-bottom: 1px solid #2c2c2c;
  font-size: 13px;
}
.routes a {
  color: #999;
  text-decoration: none;
}
.routes a.router-link-exact-active {
  color: #9fd8e0;
}
.view {
  flex: 1;
  min-height: 0;
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
