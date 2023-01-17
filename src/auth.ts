import { Codeartifact } from '@aws-sdk/client-codeartifact'
import { decorateDefaultCredentialProvider } from '@aws-sdk/client-sts'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { parseSyml } from '@yarnpkg/parsers'
import fs from 'fs'
import path from 'path'

type AuthorizationTokenParams = {
  domain: string
  domainOwner: string
  region: string
}

type CAClient = {
  client: Codeartifact
  registryInfo: AuthorizationTokenParams
}

let registryUrl: string
let cachedClient: CAClient | undefined

/**
 * Set the registry url from (yarn) config
 *
 * @param filename Opened package.json path. Search for yarn config with registry url starts here
 * @param forceCheck Search for and read the yarn config even if a registry url is already set
 * @returns void
 */
export const setRegistryUrl = (filename: string, forceCheck = false) => {
  // Once the registryUrl is set, we will skip checking for a new one unless forced
  // TODO: Its possible to have multiple registries, even by scope
  // We could refactor this extension to support that, but for now it supports 1 registry
  if (registryUrl && !forceCheck) {
    return
  }

  const yarnrcName = '.yarnrc.yml'
  let currentFolder = path.dirname(filename)
  let newRegistryUrl = ''

  // Find yarnrc.yml file
  // There is also a global config to check?
  // Also, env vars can hold the value as well?
  do {
    const yarnrcPath = path.join(currentFolder, yarnrcName)
    console.debug('checking', yarnrcPath)

    if (fs.existsSync(yarnrcPath)) {
      const content = fs.readFileSync(yarnrcPath, `utf8`)
      const data = parseSyml(content)
      newRegistryUrl = data['npmRegistryServer']
      console.debug('registryUrl', newRegistryUrl)
      break
    }

    // Reached the root
    if (path.dirname(currentFolder) === currentFolder) {
      break
    }

    // Up 1 directory
    currentFolder = path.dirname(currentFolder)
  } while (true)

  // If we have a new registryUrl and it is different from the current one,
  // set it and reset the CA client
  if (newRegistryUrl && newRegistryUrl !== registryUrl) {
    cachedClient = undefined
    registryUrl = newRegistryUrl
  }
}

/**
 * Get (create if needed) a Code Artifact client. The client is cached.
 *
 * @returns Code Artifact client
 */
export const getCodeArtifactClient = (): CAClient => {
  if (cachedClient) {
    console.debug('Using cached CA Client')
    return cachedClient
  }

  console.debug('Creating a CA Client. Will be cached after.')

  const { domain, domainOwner, region } = parseRegistryUrl(registryUrl)!

  const awsProfile = 'unqork-fetch'
  // const preferAwsEnvironmentCredentials = false

  const _defaultProvider = decorateDefaultCredentialProvider(defaultProvider)({
    // `awsProfile` that is any value (including `null` and `''`) should be provided as-is
    // `awsProfile` that is `undefined` should be excluded
    ...(awsProfile !== undefined ? { profile: awsProfile } : {}),
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
    registryInfo: { domain, domainOwner, region },
  }

  return cachedClient
}

const parseRegistryUrl = (registry: string): AuthorizationTokenParams | null => {
  const match = registry.match(/^https?:\/\/(.+)-(\d+)\.d\.codeartifact\.(.+)\.amazonaws\.com\/npm\/(.+)\/?$/)

  if (!match) return null

  const [, domain, domainOwner, region]: string[] = match
  return { domain, domainOwner, region }
}
