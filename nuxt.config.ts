// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // SPA statica: deploy su Netlify, le chiamate vanno direttamente a Supabase
  ssr: false,
  // le funzioni in app/api sono richiamabili dalle view senza import
  imports: { dirs: ['api'] },
  runtimeConfig: {
    public: {
      supabaseUrl: '',
      supabaseAnonKey: '',
    },
  },
})
