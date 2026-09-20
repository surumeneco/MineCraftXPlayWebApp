import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const appDirectory = fileURLToPath(new URL('../../app/', import.meta.url))

function collectVueFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`
    return entry.isDirectory() ? collectVueFiles(path) : entry.name.endsWith('.vue') ? [path] : []
  })
}

describe('Vue SFC block order', () => {
  it('keeps template before script and style in every frontend component, page and layout', () => {
    const files = collectVueFiles(appDirectory)
    expect(files.length).toBeGreaterThan(0)
    for (const path of files) {
      const source = readFileSync(path, 'utf8').trimStart()
      const template = source.search(/^<template(?:\s|>)/m)
      const script = source.search(/^<script(?:\s|>)/m)
      const style = source.search(/^<style(?:\s|>)/m)
      expect(template, path).toBe(0)
      if (script >= 0) expect(script, path).toBeGreaterThan(template)
      if (style >= 0) expect(style, path).toBeGreaterThan(script >= 0 ? script : template)
    }
  })
})
