import { Uri } from 'vscode'
import { getCodeArtifactClient } from './auth'
import {
  cacheState,
  cacheGetPackage,
  cacheReset,
  cacheSearch,
  cacheUpdatePackage,
  cacheUpdatePackages,
  setCacheState,
  waitForReady,
} from './cache'
import { devLog } from './logging'

export type PackageInfoBasic = {
  name: string
  description?: string | undefined | null // Some packages don't have these. Signal with null.
  homepage?: string | undefined | null
  latestVersion?: string
}

const getNamespaceAndPackagePrefix = (q: string) => {
  let namespace: string | undefined = undefined
  let packagePrefix: string | undefined = undefined

  if (q.includes('/')) {
    ;[namespace, packagePrefix] = q.split('/')
  } else if (q.includes('@')) {
    namespace = q
  } else {
    packagePrefix = q
  }

  if (namespace?.includes('@')) {
    namespace = namespace.replace('@', '')
  }

  return {
    namespace: namespace || undefined,
    packagePrefix: packagePrefix || undefined,
  }
}

const joinNamespaceAndPackage = (namespace: string | undefined, pack: string | undefined) =>
  namespace ? `@${namespace}/${pack}` : pack || ''

/**
 * Used to initialize the cache with a list of all packages in the scopes
 *
 * @param scopes List of scopes to query packages for
 */
export const codeArtifactScopesInit = async (scopes: string[], force = false) => {
  // Get out if the cache is:
  // disabled - usually through extension settings
  // inproc (currently being filled) OR
  // ready BUT we are NOT "force"-ing a refresh
  if (cacheState === 'disabled' || cacheState === 'inproc' || (cacheState === 'ready' && !force)) {
    devLog('codeArtifactScopesInit process SKIPPED', cacheState)
    return
  }

  devLog('codeArtifactScopesInit process starting', cacheState)

  // Lock the cache so its not reset while working on it
  setCacheState('inproc')
  cacheReset()

  for (let s of scopes) {
    await codeArtifactPackageQuery(s, true)
  }

  devLog('codeArtifactScopesInit process complete')
  setCacheState('ready')
}

/**
 * Search for packages matching a partial package name
 *
 * @param q Partial package name to search
 * @returns Package list
 */
export const codeArtifactPackageQuery = async (q: string, skipWait = false): Promise<PackageInfoBasic[]> => {
  if (!skipWait) {
    await waitForReady()
  }
  if (cacheState === 'ready') {
    const results = cacheSearch(q)
    return results
  } else {
    const { client, registryInfo } = getCodeArtifactClient()
    const { namespace, packagePrefix } = getNamespaceAndPackagePrefix(q)

    devLog('codeArtifactPackageQuery', q, namespace, packagePrefix)

    try {
      const packageResults = await client.listPackages({
        domain: registryInfo.domain,
        repository: registryInfo.registryName,
        format: 'npm',
        namespace,
        packagePrefix,
      })

      devLog('packageResults length', packageResults.packages?.length)

      if (packageResults.packages) {
        cacheUpdatePackages(
          packageResults.packages.map((p) => ({
            name: joinNamespaceAndPackage(p.namespace, p.package),
          })),
        )
      }

      return cacheSearch(q)
    } catch (ex) {
      console.error(ex)
    }
  }
  return []
}

/**
 * Get the latest version for a package
 *
 * @param packageName Package name
 * @returns Latest version string
 */
export const codeArtifactVersionQuery = async (packageName: string, skipWait = false): Promise<string | undefined> => {
  if (!skipWait) {
    await waitForReady()
  }
  if (cacheState !== 'disabled') {
    // Check the cache
    const p = cacheGetPackage(packageName)
    if (p?.latestVersion) {
      return p.latestVersion
    }
  }

  const { client, registryInfo } = getCodeArtifactClient()

  const { namespace, packagePrefix } = getNamespaceAndPackagePrefix(packageName)

  devLog('codeArtifactVersionQuery', packageName, namespace, packagePrefix)

  try {
    const versionResults = await client.listPackageVersions({
      domain: registryInfo.domain,
      repository: registryInfo.registryName,
      format: 'npm',
      maxResults: 1,
      namespace,
      package: packagePrefix,
    })

    devLog('versionResults', versionResults.package)

    // update the cache
    cacheUpdatePackage({ name: packageName, latestVersion: versionResults.defaultDisplayVersion })

    return versionResults.defaultDisplayVersion
  } catch (ex) {
    console.error(ex)
  }
}

/**
 * Get package info for a specific package
 *
 * @param packageName Package name
 * @param resource Unused for now
 * @returns Package info
 */
export const codeArtifactPackageInfo = async (
  packageName: string,
  resource?: Uri,
  skipWait = false,
): Promise<PackageInfoBasic | undefined> => {
  if (!skipWait) {
    await waitForReady()
  }
  if (cacheState === 'ready') {
    const p = cacheGetPackage(packageName)
    // Return if we have a "fully formed" record
    // null fields means we tried but they don't exist
    if (p?.latestVersion && (p.homepage || p.homepage === null) && (p.description || p.description === null)) {
      return p
    }
  }

  const { client, registryInfo } = getCodeArtifactClient()

  const { namespace, packagePrefix } = getNamespaceAndPackagePrefix(packageName)
  devLog('codeArtifactPackageInfo', packageName, namespace, packagePrefix)

  try {
    const versionResults = await client.listPackageVersions({
      domain: registryInfo.domain,
      repository: registryInfo.registryName,
      format: 'npm',
      maxResults: 1,
      namespace,
      package: packagePrefix,
    })

    devLog('versionResults', versionResults.package)

    const packageResults = await client.describePackageVersion({
      domain: registryInfo.domain,
      repository: registryInfo.registryName,
      format: 'npm',
      namespace,
      package: packagePrefix,
      packageVersion: versionResults.defaultDisplayVersion,
    })

    devLog('packageResults', packageResults)

    const results = {
      name: packageName,
      description: packageResults.packageVersion?.summary || null,
      homepage: packageResults.packageVersion?.homePage || null,
      latestVersion: versionResults.defaultDisplayVersion,
    }

    cacheUpdatePackage(results)
    return cacheGetPackage(packageName)
  } catch (ex) {
    console.error(ex)
  }
}
