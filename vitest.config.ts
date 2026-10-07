import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // le funzioni in app/api usano gli auto-import di Nuxt: nei test
    // vengono sostituite con stub globali (vedi vi.stubGlobal)
    unstubGlobals: true,
    restoreMocks: true,
  },
})
