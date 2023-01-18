# aws-codeartifact-intellisense-vscode

This extension for VSCode will add package.json dependencies IntelliSense support for AWS CodeArtifact repositories when using `yarn berry` and its CodeArtifact plugin.

Why: VSCode has a built in extension that has support for npm and several other public repositories, but if you are using an AWS CodeArtifact repo, you get no IntelliSense in your package.json for packages that only exist in CodeArtifact. This extension adds that support.

The extension assume a few things (scoped packages, yarn berry with a plugin). See the Requirements section.

## Features

- Package name and version suggestions
- Hover details
- Package detail caching
- `reset` command is available through the Command Palette and the "..." editor title menu

## Requirements

The extension assumes that:
- you are using yarn berry
- you are using the yarn CodeArtifact plugin [yarn-plugin-aws-codeartifact](https://github.com/mhassan1/yarn-plugin-aws-codeartifact)
- your packages are scoped (@yourcompany/yourpackage) to limit collisions between npm packages. VSCode's own extension still runs and shows npm packages. Allowing searches in CA for non-scoped packages leads to a lot of duplicate information shown. Perhaps enhancements to come on this. 

The following settings are required and used from yarn/plugin config files:
- `npmRegistryServer` from the first `.yarnrc.yml` file it finds.
- `npmRegistryServerConfig.awsProfile` from the first `.yarn-plugin-aws-codeartifact.yml` file it finds.

The extension searches for these config files starting in the directory of the package.json being viewed before moving up directories until they are found.

## Extension Settings

This extension contributes the following settings:

* `awsCodeArtifactIntellisense.scopes`: An array of scopes (@yourcompany) to suggest and restrict searches
* `awsCodeArtifactIntellisense.cache`: Boolean controlling if the cache is used. Otherwise, api calls to CA are repeated.
* `awsCodeArtifactIntellisense.detailedLogs`: Boolean controlling if detailed logs are output. This can help troubleshooting.

## Known Issues

Queries can be slow against CodeArtifact (especially initial queries). There is aggressive caching to help this. The first query will pull down a listing of all scoped packages to get things seeded. Use the `reset` command to clear the cache when you need updated package information.
