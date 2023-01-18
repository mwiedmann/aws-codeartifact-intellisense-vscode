/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
  CompletionItemKind,
  CompletionItem,
  DocumentSelector,
  SnippetString,
  workspace,
  MarkdownString,
  Uri,
  l10n,
} from 'vscode'
import { IJSONContribution, ISuggestionsCollector } from './jsonContributions'
import { Location } from 'jsonc-parser'
import { codeArtifactPackageInfo, codeArtifactPackageQuery, PackageInfoBasic } from './queries'
import { devLog, log } from './logging'

export class PackageJSONContribution implements IJSONContribution {
  private knownScopes: string[]

  constructor() {
    this.knownScopes = workspace.getConfiguration('awsCodeArtifactIntellisense').scopes
    log('Loaded scopes from config', this.knownScopes)
  }

  public getDocumentSelector(): DocumentSelector {
    return [{ language: 'json', scheme: '*', pattern: '**/package.json' }]
  }

  public collectDefaultSuggestions(_resource: Uri, result: ISuggestionsCollector): Thenable<any> {
    const defaultValue = {
      name: '${1:name}',
      description: '${2:description}',
      authors: '${3:author}',
      version: '${4:1.0.0}',
      main: '${5:pathToMain}',
      dependencies: {},
    }
    const proposal = new CompletionItem(l10n.t('Default package.json'))
    proposal.kind = CompletionItemKind.Module
    proposal.insertText = new SnippetString(JSON.stringify(defaultValue, null, '\t'))
    result.add(proposal)
    return Promise.resolve(null)
  }

  private isEnabled() {
    return true // return this.npmCommandPath || this.onlineEnabled()
  }

  private onlineEnabled() {
    return true // !!workspace.getConfiguration('npm').get('fetchOnlinePackageInfo')
  }

  public async collectPropertySuggestions(
    _resource: Uri,
    location: Location,
    currentWord: string,
    addValue: boolean,
    isLast: boolean,
    collector: ISuggestionsCollector,
  ): Promise<any> {
    if (!this.isEnabled()) {
      return null
    }

    if (
      location.matches(['dependencies']) ||
      location.matches(['devDependencies']) ||
      location.matches(['optionalDependencies']) ||
      location.matches(['peerDependencies'])
    ) {
      devLog('collectPropertySuggestions', currentWord)
      if (currentWord.length > 0) {
        if (currentWord[0] === '@') {
          if (currentWord.indexOf('/') !== -1) {
            return this.collectScopedPackages(currentWord, addValue, isLast, collector)
          }
          for (const scope of this.knownScopes) {
            const proposal = new CompletionItem(scope)
            proposal.kind = CompletionItemKind.Property
            proposal.insertText = new SnippetString().appendText(`"${scope}/`).appendTabstop().appendText('"')
            proposal.filterText = JSON.stringify(scope)
            proposal.documentation = ''
            proposal.command = {
              title: '',
              command: 'editor.action.triggerSuggest',
            }
            collector.add(proposal)
          }
          collector.setAsIncomplete()
        }

        if (this.knownScopes.some((s) => currentWord.includes(s)))
          return codeArtifactPackageQuery(currentWord).then(
            (success) => {
              if (success.length > 0) {
                for (const p of success) {
                  this.processPackage(p, addValue, isLast, collector)
                }
                collector.setAsIncomplete()
              }
              return undefined
            },
            (error) => {
              collector.error(l10n.t('Request to the NPM repository failed: {0}', error.responseText))
              return 0
            },
          )
      } else {
        // The default extension in VSCode already handles this
        // Perhaps we will have our own set of mostDependedOn in the future and will use this section

        // this.mostDependedOn.forEach((name) => {
        //   const insertText = new SnippetString().appendText(JSON.stringify(name))
        //   if (addValue) {
        //     insertText.appendText(': "').appendTabstop().appendText('"')
        //     if (!isLast) {
        //       insertText.appendText(',')
        //     }
        //   }
        //   const proposal = new CompletionItem(name)
        //   proposal.kind = CompletionItemKind.Property
        //   proposal.insertText = insertText
        //   proposal.filterText = JSON.stringify(name)
        //   proposal.documentation = ''
        //   collector.add(proposal)
        // })
        // this.collectScopedPackages(currentWord, addValue, isLast, collector)
        // collector.setAsIncomplete()
        return Promise.resolve(null)
      }
    }
    return null
  }

  private async collectScopedPackages(
    currentWord: string,
    addValue: boolean,
    isLast: boolean,
    collector: ISuggestionsCollector,
  ): Promise<any> {
    const segments = currentWord.split('/')
    if (segments.length === 2 && segments[0].length > 1) {
      const scope = segments[0].substr(1)
      let name = segments[1]
      if (name.length < 4) {
        name = ''
      }

      return codeArtifactPackageQuery(currentWord).then(
        (success) => {
          if (success.length > 0) {
            for (const p of success) {
              this.processPackage(p, addValue, isLast, collector)
            }
            collector.setAsIncomplete()
          }
          return undefined
        },
        (error) => {
          collector.error(l10n.t('Request to the NPM repository failed: {0}', error.responseText))
          return 0
        },
      )
    }
    return Promise.resolve(null)
  }

  public async collectValueSuggestions(resource: Uri, location: Location, result: ISuggestionsCollector): Promise<any> {
    if (!this.isEnabled()) {
      return null
    }

    if (
      location.matches(['dependencies', '*']) ||
      location.matches(['devDependencies', '*']) ||
      location.matches(['optionalDependencies', '*']) ||
      location.matches(['peerDependencies', '*'])
    ) {
      const currentKey = location.path[location.path.length - 1]
      if (typeof currentKey === 'string' && this.knownScopes.some((s) => currentKey.includes(s))) {
        const info = await this.fetchPackageInfo(currentKey, resource)
        if (info && info.version) {
          let name = JSON.stringify(info.version)
          let proposal = new CompletionItem(name)
          proposal.kind = CompletionItemKind.Property
          proposal.insertText = name
          proposal.documentation = l10n.t('The currently latest version of the package')
          result.add(proposal)

          name = JSON.stringify('^' + info.version)
          proposal = new CompletionItem(name)
          proposal.kind = CompletionItemKind.Property
          proposal.insertText = name
          proposal.documentation = l10n.t('Matches the most recent major version (1.x.x)')
          result.add(proposal)

          name = JSON.stringify('~' + info.version)
          proposal = new CompletionItem(name)
          proposal.kind = CompletionItemKind.Property
          proposal.insertText = name
          proposal.documentation = l10n.t('Matches the most recent minor version (1.2.x)')
          result.add(proposal)
        }
      }
    }
    return null
  }

  private getDocumentation(
    description: string | undefined,
    version: string | undefined,
    homepage: string | undefined,
  ): MarkdownString {
    const str = new MarkdownString()
    if (description) {
      str.appendText(description)
    }
    if (version) {
      str.appendText('\n\n')
      str.appendText(l10n.t('Latest version: {0}', version))
    }
    if (homepage) {
      str.appendText('\n\n')
      str.appendText(homepage)
    }
    return str
  }

  public resolveSuggestion(resource: Uri | undefined, item: CompletionItem): Thenable<CompletionItem | null> | null {
    if (item.kind === CompletionItemKind.Property && !item.documentation) {
      let name = item.label
      if (typeof name !== 'string') {
        name = name.label
      }

      return this.fetchPackageInfo(name, resource).then((info) => {
        if (info) {
          item.documentation = this.getDocumentation(info.description, info.version, info.homepage)
          return item
        }
        return null
      })
    }
    return null
  }

  private isValidNPMName(name: string): boolean {
    // following rules from https://github.com/npm/validate-npm-package-name
    if (!name || name.length > 214 || name.match(/^[_.]/)) {
      return false
    }
    const match = name.match(/^(?:@([^/]+?)[/])?([^/]+?)$/)
    if (match) {
      const scope = match[1]
      if (scope && encodeURIComponent(scope) !== scope) {
        return false
      }
      const name = match[2]
      return encodeURIComponent(name) === name
    }
    return false
  }

  private async fetchPackageInfo(pack: string, resource: Uri | undefined): Promise<ViewPackageInfo | undefined> {
    if (!this.isValidNPMName(pack)) {
      return undefined // avoid unnecessary lookups
    }
    let info: ViewPackageInfo | undefined
    // if (this.npmCommandPath) {
    //   info = await this.npmView(this.npmCommandPath, pack, resource)
    // }
    if (!info && this.onlineEnabled()) {
      info = await this.npmjsView(pack)
    }
    return info
  }

  private async npmjsView(pack: string): Promise<ViewPackageInfo | undefined> {
    const results = await codeArtifactPackageInfo(pack)
    if (results) {
      return {
        description: results.description || '',
        version: results.latestVersion,
        homepage: results.homepage || '',
      }
    }
    return undefined
  }

  public getInfoContribution(resource: Uri, location: Location): Thenable<MarkdownString[] | null> | null {
    if (!this.isEnabled()) {
      return null
    }
    if (
      location.matches(['dependencies', '*']) ||
      location.matches(['devDependencies', '*']) ||
      location.matches(['optionalDependencies', '*']) ||
      location.matches(['peerDependencies', '*'])
    ) {
      const pack = location.path[location.path.length - 1]
      // We are only checking if the package is in our knownScopes
      // The standard VSCode Extension will handle the rest
      if (typeof pack === 'string' && this.knownScopes.some((s) => pack.includes(s))) {
        return this.fetchPackageInfo(pack, resource).then((info) => {
          if (info) {
            return [this.getDocumentation(info.description, info.version, info.homepage)]
          }
          return null
        })
      }
    }
    return null
  }

  private processPackage(pack: PackageInfoBasic, addValue: boolean, isLast: boolean, collector: ISuggestionsCollector) {
    if (pack && pack.name) {
      const insertText = new SnippetString().appendText(JSON.stringify(pack.name))
      if (addValue) {
        insertText.appendText(': "')
        if (pack.latestVersion) {
          insertText.appendVariable('version', pack.latestVersion)
        } else {
          insertText.appendTabstop()
        }
        insertText.appendTabstop()
        insertText.appendText('"')
        if (!isLast) {
          insertText.appendText(',')
        }
      }
      const proposal = new CompletionItem(pack.name)
      proposal.kind = CompletionItemKind.Property
      proposal.insertText = insertText
      proposal.filterText = JSON.stringify(pack.name)
      // proposal.documentation = this.getDocumentation(pack.description, pack.version, pack?.links?.homepage)
      collector.add(proposal)
    }
  }
}

interface SearchPackageInfo {
  name: string
  description?: string
  version?: string
  links?: { homepage?: string }
}

interface ViewPackageInfo {
  description: string
  version?: string
  homepage?: string
}
