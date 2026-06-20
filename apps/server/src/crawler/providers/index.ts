import { config } from "../../config.js";
import { GitHubProvider } from "./github-provider.js";
import { AzureDevOpsProvider } from "./azure-devops-provider.js";
import { LocalProvider } from "./local-provider.js";
import type { RepositoryProvider } from "./repository-provider.js";

export type { RepositoryProvider };

const providers: RepositoryProvider[] = [
  new GitHubProvider(),
  new AzureDevOpsProvider({ config }),
  new LocalProvider(),
];

export function getProvider(url: string): RepositoryProvider {
  for (const provider of providers) {
    if (provider.canHandle(url)) return provider;
  }
  throw new Error(`No provider found for URL/path: ${url}`);
}

export { GitHubProvider, AzureDevOpsProvider, LocalProvider };
