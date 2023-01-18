import { devLog } from './logging'
import { PackageInfoBasic } from './queries'

/*
    The cache acts as a cache but also serves as a place to combine data for a package together.
    Package data comes from several different queries which are run at different times.
    For instance, the initial query comes back with package names but has no version or other info.
    As the rest of the queries run, we build up the record for a package and store it here.
    So even if caching is disabled, the cache is still used to hold the combined records.

    Package Info
    When a package is updated, we only overwrite existing fields if the incoming record has data.
    Each update may come in with only partial info, so we update the cache with new fields that have data.
    We use 'null' to signify that there isn't data for a field. This is common with homepage and description fields.
*/
const packageCache = new Map<string, PackageInfoBasic>()

type CacheState = 'empty' | 'inproc' | 'ready' | 'disabled'

/**
 * Current state of the cache
 */
export let cacheState: CacheState = 'empty'

/**
 * Set the cache state
 *
 * @param state Cache state
 */
export const setCacheState = (state: CacheState) => {
  cacheState = state
}

/**
 * Wait for the cache to be ready
 *
 * @returns Promise that resolves when the cache is ready
 */
export const waitForReady = async () => {
  return new Promise<void>((resolve) => {
    // If the cache is disabled, quit immediately
    if (cacheState === 'disabled' || cacheState === 'ready') {
      resolve()
      return
    }

    let maxWait = 30

    // Check every 1 second to see if the cache is ready
    const token = setInterval(() => {
      devLog('Waiting for cache to be ready', maxWait)
      if (cacheState === 'ready') {
        devLog('Cache is ready', maxWait)
        clearInterval(token)
        resolve()
      } else {
        maxWait--
        if (maxWait === 0) {
          devLog('Timeout waiting on cache')
          clearInterval(token)
          resolve()
        }
      }
    }, 1000)
  })
}

/**
 * Update the cache with a list of packages
 *
 * @param list Package list
 */
export const cacheUpdatePackages = (list: PackageInfoBasic[]) => {
  list.forEach((p) => {
    cacheUpdatePackage(p)
  })
}

/**
 * Update the info for a package
 *
 * @param info Package info
 */
export const cacheUpdatePackage = (info: PackageInfoBasic) => {
  const existing = packageCache.get(info.name)

  // Update fields only if the info has data
  // We will get only partial data sometimes
  // due to how the queries are run
  const newPackage = Object.entries(info).reduce(
    (prev, [k, v]) => {
      if (v || v === null) {
        prev[k] = v
      }
      return prev
    },
    { ...existing } as any,
  ) as PackageInfoBasic

  devLog('Cache update', existing, newPackage)
  packageCache.set(info.name, newPackage)
}

/**
 * Search the cache for pacakges partially matching the string
 *
 * @param q Search string
 * @returns List of packages
 */
export const cacheSearch = (q: string) => {
  const results: PackageInfoBasic[] = []
  for (let [k, v] of packageCache.entries()) {
    if (k.includes(q)) {
      results.push(v)
    }
  }

  return results
}

/**
 * Get a package by name
 *
 * @param name Package name
 * @returns Package info
 */
export const cacheGetPackage = (name: string) => {
  return packageCache.get(name)
}

/**
 * Clear the entire cache
 */
export const cacheReset = () => {
  packageCache.clear()
}
