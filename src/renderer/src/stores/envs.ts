import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Environment, EnvVariable } from '../../../shared/types'
import { interpolate, makeLookup } from '../lib/interpolate'
import { watchPersist } from './persist'

export const useEnvsStore = defineStore('envs', () => {
  const environments = ref<Environment[]>([])
  const globals = ref<EnvVariable[]>([])
  const activeEnvId = ref<string | null>(null)

  const activeEnv = computed<Environment | null>(
    () => environments.value.find((e) => e.id === activeEnvId.value) ?? null
  )

  function resolve(name: string): string | null {
    const lookup = makeLookup([activeEnv.value?.variables ?? [], globals.value])
    return lookup(name) ?? null
  }

  function interpolateText(text: string): string {
    return interpolate(text, makeLookup([activeEnv.value?.variables ?? [], globals.value]))
  }

  function upsertEnv(env: Environment): void {
    const idx = environments.value.findIndex((e) => e.id === env.id)
    if (idx >= 0) environments.value[idx] = env
    else environments.value.push(env)
  }

  function deleteEnv(id: string): void {
    environments.value = environments.value.filter((e) => e.id !== id)
    if (activeEnvId.value === id) activeEnvId.value = null
  }

  function duplicateEnv(id: string): Environment | null {
    const src = environments.value.find((e) => e.id === id)
    if (!src) return null
    const copy: Environment = {
      id: crypto.randomUUID(),
      name: src.name + ' 副本',
      variables: src.variables.map((v) => ({ ...v, id: crypto.randomUUID() }))
    }
    environments.value.push(copy)
    return copy
  }

  function hydrate(data: { environments?: Environment[]; globals?: EnvVariable[]; activeEnvId?: string | null }): void {
    environments.value = data.environments ?? []
    globals.value = data.globals ?? []
    activeEnvId.value = data.activeEnvId ?? null
  }

  watchPersist(() => environments.value, 'environments')
  watchPersist(() => globals.value, 'globals')
  watchPersist(() => activeEnvId.value, 'activeEnvId')

  return { environments, globals, activeEnvId, activeEnv, resolve, interpolateText, upsertEnv, deleteEnv, duplicateEnv, hydrate }
})
