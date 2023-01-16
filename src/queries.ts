import { PackageSummary } from '@aws-sdk/client-codeartifact'
import { Uri } from 'vscode'
import { getCodeArtifactClient } from './auth'

const repository = 'unqork-common'

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

export type PackageSummaryAndVersion = { summary: PackageSummary; version: string }

export const codeArtifactPackageQuery = async (q: string) => {
  const { client, registryInfo } = getCodeArtifactClient()

  const { namespace, packagePrefix } = getNamespaceAndPackagePrefix(q)

  console.debug('codeArtifactPackageQuery', q, namespace, packagePrefix)

  try {
    const packageResults = await client.listPackages({
      domain: registryInfo.domain,
      repository,
      format: 'npm',
      namespace,
      packagePrefix,
    })

    client.send
    console.debug('packageResults length', packageResults.packages?.length)

    let results: PackageSummaryAndVersion[] = []

    if (packageResults.packages) {
      for (const p of packageResults.packages) {
        // This is WAY too slow
        // Is there a way to get the version info at the same time? I don't see one.
        // const version = (await codeArtifactVersionQuery(joinNamespaceAndPackage(p.namespace, p.package))) || ''
        const version = ''
        results.push({
          summary: p,
          version,
        })
      }
      return results
    }
  } catch (ex) {
    console.error(ex)
  }
  return []
}

export const codeArtifactVersionQuery = async (packageName: string) => {
  const { client, registryInfo } = getCodeArtifactClient()

  const { namespace, packagePrefix } = getNamespaceAndPackagePrefix(packageName)

  console.debug('codeArtifactVersionQuery', packageName, namespace, packagePrefix)

  try {
    const versionResults = await client.listPackageVersions({
      domain: registryInfo.domain,
      repository,
      format: 'npm',
      namespace,
      package: packagePrefix,
    })

    console.debug('versionResults', versionResults)

    return versionResults.defaultDisplayVersion
  } catch (ex) {
    console.error(ex)
  }
}

export const codeArtifactPackageInfo = async (pack: string, resource?: Uri) => {
  const { client, registryInfo } = getCodeArtifactClient()

  const { namespace, packagePrefix } = getNamespaceAndPackagePrefix(pack)
  console.debug('codeArtifactPackageInfo', pack, namespace, packagePrefix)

  try {
    const versionResults = await client.listPackageVersions({
      domain: registryInfo.domain,
      repository,
      format: 'npm',
      namespace,
      package: packagePrefix,
    })

    console.debug('versionResults', versionResults)

    const packageResults = await client.describePackageVersion({
      domain: registryInfo.domain,
      repository,
      format: 'npm',
      namespace,
      package: packagePrefix,
      packageVersion: versionResults.defaultDisplayVersion,
    })

    console.debug('packageResults', packageResults)

    return packageResults
  } catch (ex) {
    console.error(ex)
  }
}
