// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/fonts',
    '@nuxtjs/mdc',
    '@vueuse/nuxt',
    '@nuxt/content',
    'nuxt-file-storage'
  ],

  ssr: false,

  devtools: {
    enabled: process.env.NODE_ENV === 'development'
  },

  css: ['~/assets/css/main.css'],

  mdc: {
    highlight: {
      // noApiRoute: true
      shikiEngine: 'javascript'
    }
  },

  // Runtime config for environment variables
  runtimeConfig: {
    // Private keys that are only available server-side
    openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
    openrouterModel: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4.1-flash-1017',
    livekitKey: process.env.LIVEKIT_KEY || '',
    livekitSecret: process.env.LIVEKIT_SECRET || '',
    // Web Push: the VAPID key pair signs pushes; push is off when the keys are unset
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
    vapidSubject: process.env.VAPID_SUBJECT || 'https://ramble.lastra.us',
    // Persistent server data (push subscriptions); a volume of its own in production
    dataDir: process.env.DATA_DIR || './.data/ramble',
    // Shared secret ramble-daemon sends to /api/events; the stream is off when unset
    eventsToken: process.env.EVENTS_TOKEN || '',
    // Public keys that are exposed to the client
    public: {
      livekitUrl: process.env.LIVEKIT_URL || 'ws://localhost:7880',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      daemonUrl: process.env.NUXT_PUBLIC_DAEMON_URL || 'http://localhost:9001',
      daemonEnabled: process.env.NUXT_PUBLIC_DAEMON_ENABLED !== 'false',
      vapidPublicKey: process.env.NUXT_PUBLIC_VAPID_PUBLIC_KEY || ''
    }
  },

  experimental: {
    viewTransition: true
  },

  compatibilityDate: '2024-07-11',

  vite: {
    $server: {
      build: {
        rollupOptions: {
          output: {
            preserveModules: true
          }
        }
      }
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  fileStorage: {
    mount: process.env.FILE_STORAGE_MOUNT || './uploads'
  },

  fonts: {
    families: [
      { name: 'Inter', provider: 'google' },
      { name: 'Geist Mono', provider: 'google' },
      { name: 'Cherry Bomb One', provider: 'google' }
    ],
    defaults: {
      weights: [400, 500, 600, 700],
      styles: ['normal'],
      subsets: ['latin']
    }
  }
})
