import { mount } from 'svelte';
import './ui/theme.css';
import App from './App.svelte';

if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}

export default mount(App, { target: document.getElementById('app')! });
