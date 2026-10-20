import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import App from './App.vue';
import ConnectionLineView from './views/ConnectionLineView.vue';
import PatchbayView from './views/PatchbayView.vue';
import StressView from './views/StressView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: ConnectionLineView },
    { path: '/patchbay', component: PatchbayView },
    { path: '/stress', component: StressView },
  ],
});

createApp(App).use(router).mount('#app');
