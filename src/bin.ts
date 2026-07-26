#!/usr/bin/env node

import process from 'node:process'
import { runCli } from './cli'

runCli(process.argv.slice(2), { cwd: process.cwd() }).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
