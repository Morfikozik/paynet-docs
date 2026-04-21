import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'fs';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  assetsInclude: ['**/*.yaml', '**/*.yml'],
  build: {
    rollupOptions: {
      plugins: [
        {
          name: 'copy-openapi',
          writeBundle() {
            // Copy openapi.json to dist folder after build
            try {
              copyFileSync(
                resolve(__dirname, 'src/openapi/openapi.json'),
                resolve(__dirname, 'dist/openapi.json')
              );
              console.log('✓ Copied openapi.json to dist folder');
            } catch (error) {
              console.warn('⚠ Could not copy openapi.json:', error.message);
            }
          }
        }
      ]
    }
  }
});
