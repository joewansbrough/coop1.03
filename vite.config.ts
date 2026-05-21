import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        tailwindcss(),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL),
        'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        chunkSizeWarningLimit: 1500,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (!id.includes('node_modules')) return undefined;
              if (id.includes('@react-pdf') || id.includes('pdf-parse') || id.includes('pdfjs-dist') || id.includes('fontkit') || id.includes('linebreak') || id.includes('yoga-layout') || id.includes('unicode-properties') || id.includes('unicode-trie') || id.includes('png-js') || id.includes('brotli')) {
                return 'vendor-pdf';
              }
              if (id.includes('react-dom') || id.includes('scheduler')) {
                return 'vendor-react-dom';
              }
              if (id.includes('react-router-dom') || id.includes('@remix-run')) {
                return 'vendor-router';
              }
              if (id.includes('@tanstack')) {
                return 'vendor-query';
              }
              if (id.includes('node_modules/react/')) {
                return 'vendor-react';
              }
              if (id.includes('recharts')) {
                return 'vendor-charts';
              }
              if (id.includes('@google') || id.includes('googleapis')) {
                return 'vendor-ai';
              }
              if (id.includes('framer-motion') || id.includes('motion') || id.includes('@dnd-kit')) {
                return 'vendor-motion';
              }
              if (id.includes('react-quill-new') || id.includes('quill')) {
                return 'vendor-editor';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('axios') || id.includes('dompurify') || id.includes('file-saver')) {
                return 'vendor-utils';
              }
              return undefined;
            },
          },
        },
      }
    };
});
