# aws-codeartifact-intellisense-vscode

This extension for VSCode will add package.json dependencies IntelliSense support for AWS CodeArtifact repositories.

Why: VSCode has a built in extension that has support for npm and several other public repositories, but if you are using an AWS CodeArtifact repo, you get no IntelliSense in your package.json for packages that only exist in CodeArtifact. This extension adds that support.

It assumes that your packages are scoped (@yourcompany/yourpackage) to limit collisions between npm packages.

## Features

- Package name and version suggestions
- Hover details

## Requirements

Currently loads the `npmRegistryServer` from the `.yarnrc.yml` in your project.

## Extension Settings

This extension contributes the following settings:

* `awsCodeArtifactIntellisense.scopes`: An array of scopes (@yourcompany) to suggest and restrict searches

## Known Issues

Queries can be slow (especially initial queries). Researching the cause.
