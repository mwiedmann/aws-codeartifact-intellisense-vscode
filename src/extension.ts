// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { ExtensionContext, workspace } from 'vscode'
import { setCacheState } from './cache'
import { addJSONProviders } from './jsonContributions'
import { setLoggingMode } from './logging'

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('aws-codeartifact-intellisense-vscode is active!')

  const extensionSettings = (({ cache, detailedLogs, scopes }: any) => ({ cache, detailedLogs, scopes }))(
    workspace.getConfiguration('awsCodeArtifactIntellisense'),
  )

  console.log('aws-codeartifact-intellisense-vscode settings loaded', extensionSettings)

  if (!extensionSettings.cache) {
    setCacheState('disabled')
  }

  // 'dev' will show much more detailed logs
  setLoggingMode(extensionSettings.detailedLogs ? 'dev' : 'prod')

  context.subscriptions.push(addJSONProviders())
}

// This method is called when your extension is deactivated
export function deactivate() {}
