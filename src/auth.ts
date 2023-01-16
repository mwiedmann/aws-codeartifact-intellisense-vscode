import { Codeartifact } from '@aws-sdk/client-codeartifact'
import { decorateDefaultCredentialProvider } from '@aws-sdk/client-sts'
import { defaultProvider } from '@aws-sdk/credential-provider-node'

type AuthorizationTokenParams = {
  domain: string
  domainOwner: string
  region: string
}

type CAClient = {
  client: Codeartifact
  registryInfo: AuthorizationTokenParams
}

const registryUrl = 'https://unqork-eng-682682801491.d.codeartifact.us-east-2.amazonaws.com/npm/unqork-common/'

let cachedClient: CAClient

export const getCodeArtifactClient = (): CAClient => {
  if (cachedClient) {
    console.log('Using cached CA Client')
    return cachedClient
  }

  console.log('Creating a CA Client. Will be cached after.')

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

const getTokenClient = async () => {
  const { client, registryInfo } = getCodeArtifactClient()
  const { domain, domainOwner, region } = registryInfo

  const params = {
    domain,
    domainOwner,
    // this should be more than enough time to complete the command
    // we are not persisting this token anywhere once the command is complete
    // https://docs.aws.amazon.com/codeartifact/latest/APIReference/API_GetAuthorizationToken.html#API_GetAuthorizationToken_RequestSyntax
    durationSeconds: 900, // 15 minutes
  }

  const authorizationToken = (await client.getAuthorizationToken(params)).authorizationToken
}

const parseRegistryUrl = (registry: string): AuthorizationTokenParams | null => {
  const match = registry.match(/^https?:\/\/(.+)-(\d+)\.d\.codeartifact\.(.+)\.amazonaws\.com\/npm\/(.+)\/?$/)

  if (!match) return null

  const [, domain, domainOwner, region]: string[] = match
  return { domain, domainOwner, region }
}
