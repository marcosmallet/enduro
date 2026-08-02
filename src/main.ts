import { registerSW } from 'virtual:pwa-register';
import { GameController } from './GameController';
import './style.css';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Application root not found.');

new GameController(app);
registerSW({ immediate: true });
