// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { ExtensionContext } from 'vscode'
import { addJSONProviders } from './jsonContributions'
import { setLoggingMode } from './logging'

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('aws-codeartifact-intellisense-vscode is active!')

  // Uncomment this to show a lot of additional logging
  // setLoggingMode('dev')

  context.subscriptions.push(addJSONProviders())
}

// This method is called when your extension is deactivated
export function deactivate() {}
