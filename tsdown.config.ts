import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts', 'src/bin.ts'],
  dts: true,
})
