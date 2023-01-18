import { Codeartifact } from '@aws-sdk/client-codeartifact'
import { decorateDefaultCredentialProvider } from '@aws-sdk/client-sts'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { parseSyml } from '@yarnpkg/parsers'
import fs from 'fs'
import path from 'path'
import { devLog, log } from './logging'

type AuthorizationTokenParams = {
  domain: string
  domainOwner: string
  region: string
  registryName: string
}

type CAClient = {
  client: Codeartifact
  registryInfo: AuthorizationTokenParams
}

type RegistryInfo = {
  registryUrl: string
  awsProfile: string
}

let registryInfo: RegistryInfo = {
  registryUrl: '',
  awsProfile: '',
}

let cachedClient: CAClient | undefined

/**
 * Clear the registry info so it will be configured on the next call.
 * Use this when a new project has been opened or when the registry info could have changed.
 */
export const clearRegistryInfo = () => {
  registryInfo = {
    registryUrl: '',
    awsProfile: '',
  }
}

/**
 * Set the registry url from (yarn) config
 *
 * @param filename Opened package.json path. Search for yarn config with registry url starts here
 * @param forceCheck Search for and read the yarn config even if a registry url is already set
 * @returns void
 */
export const setRegistryInfo = (filename: string, forceCheck = false) => {
  // Once the registryUrl is set, we will skip checking for a new one unless forced
  // TODO: Its possible to have multiple registries, even by scope
  // We could refactor this extension to support that, but for now it supports 1 registry
  if (registryInfo.registryUrl && registryInfo.awsProfile && !forceCheck) {
    return
  }

  const yarnrcName = '.yarnrc.yml'
  const pluginName = '.yarn-plugin-aws-codeartifact.yml'
  let currentFolder = path.dirname(filename)
  let newRegistryInfo: RegistryInfo = {
    registryUrl: '',
    awsProfile: '',
  }

  // Find yarnrc.yml and plugin files
  // There is also a global config to check?
  // Also, env vars can hold the value as well?
  do {
    // Check for .yarnrc.yml
    const yarnrcPath = path.join(currentFolder, yarnrcName)
    devLog('checking for .yarnrc', yarnrcPath)
    if (!newRegistryInfo.registryUrl && fs.existsSync(yarnrcPath)) {
      const content = fs.readFileSync(yarnrcPath, `utf8`)
      const data = parseSyml(content)
      newRegistryInfo.registryUrl = data['npmRegistryServer'] || ''
      log('registryUrl', newRegistryInfo.registryUrl)
    }

    // Check for the plugin yml
    const pluginPath = path.join(currentFolder, pluginName)
    devLog('checking for plugin', pluginPath)
    if (!newRegistryInfo.awsProfile && fs.existsSync(pluginPath)) {
      const content = fs.readFileSync(pluginPath, `utf8`)
      const data = parseSyml(content)
      newRegistryInfo.awsProfile = data['npmRegistryServerConfig']?.['awsProfile'] || ''
      log('awsProfile', newRegistryInfo.awsProfile)
    }

    // Quit once we have both settings
    if (newRegistryInfo.registryUrl && newRegistryInfo.awsProfile) {
      break
    }

    // Reached the root
    if (path.dirname(currentFolder) === currentFolder) {
      break
    }

    // Up 1 directory
    currentFolder = path.dirname(currentFolder)
  } while (true)

  // If we have a new registry settings and they different from the current one,
  // set it and reset the CA client
  if (newRegistryInfo.registryUrl && newRegistryInfo.registryUrl !== registryInfo.registryUrl) {
    cachedClient = undefined
    registryInfo.registryUrl = newRegistryInfo.registryUrl
  }

  if (newRegistryInfo.awsProfile && newRegistryInfo.awsProfile !== registryInfo.awsProfile) {
    cachedClient = undefined
    registryInfo.awsProfile = newRegistryInfo.awsProfile
  }
}

/**
 * Get (create if needed) a Code Artifact client. The client is cached.
 *
 * @returns Code Artifact client
 */
export const getCodeArtifactClient = (): CAClient => {
  if (cachedClient) {
    devLog('Using cached CA Client')
    return cachedClient
  }

  devLog('Creating a CA Client. Will be cached after.')

  const { domain, domainOwner, region, registryName } = parseRegistryUrl(registryInfo.registryUrl)!

  // const preferAwsEnvironmentCredentials = false

  const _defaultProvider = decorateDefaultCredentialProvider(defaultProvider)({
    // `awsProfile` that is any value (including `null` and `''`) should be provided as-is
    // `awsProfile` that is `undefined` should be excluded
    ...(registryInfo.awsProfile !== undefined ? { profile: registryInfo.awsProfile } : {}),
  })

  // const credentials = miscUtils.parseOptionalBoolean(preferAwsEnvironmentCredentials)
  //   ? chain(fromEnv(), _defaultProvider)
  //   : _defaultProvider

  const credentials = _defaultProvider

  const client = new Codeartifact({
    region,
    credentials,
  })

  cachedClient = {
    client,
    registryInfo: { domain, domainOwner, region, registryName },
  }

  return cachedClient
}

const parseRegistryUrl = (registry: string): AuthorizationTokenParams | null => {
  const match = registry.match(/^https?:\/\/(.+)-(\d+)\.d\.codeartifact\.(.+)\.amazonaws\.com\/npm\/(.+)\/?$/)

  if (!match) return null

  const p = registry.split('/')
  const registryName = p[p.length - 2] || p[p.length - 1]

  const [, domain, domainOwner, region]: string[] = match
  return { domain, domainOwner, region, registryName }
}
