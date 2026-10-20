/*
vite.config.js — tells Vite how to build/serve this project.
`react()` plugin lets Vite understand JSX and enables Fast Refresh
(hot-reloading that preserves component state) during development.
*/
// import react from '@vitejs/plugin-react'; -> This imports the React plugin for Vite
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
