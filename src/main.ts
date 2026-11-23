import { mount } from 'svelte';
import './ui/theme.css';
import App from './App.svelte';
import { checkOnOpen } from './lib/backup/autobackup';

if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}

const app = mount(App, { target: document.getElementById('app')! });

// Sauvegarde kDrive à l'ouverture si la dernière date de plus d'un jour.
setTimeout(() => void checkOnOpen(), 3000);

export default app;
