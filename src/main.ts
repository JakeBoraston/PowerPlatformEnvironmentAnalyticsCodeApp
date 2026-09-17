import { mount } from 'svelte'
import './app.css'
// Applies the saved light or dark mode before the first render.
import '$lib/stores/themeStore'
import AppWrapper from './AppWrapper.svelte'

const app = mount(AppWrapper, {
  target: document.getElementById('app')!,
})

export default app
