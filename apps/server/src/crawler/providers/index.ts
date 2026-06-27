import { config } from "../../config/index.js";
import { GithubProvider } from "./github-provider.js";
import { AzureDevOpsProvider } from "./azure-devops-provider.js";
import { LocalProvider } from "./local-provider.js";
import type { RepositoryProvider } from "./repository-provider.js";

export type { RepositoryProvider };

const providers: RepositoryProvider[] = [
  new GithubProvider({ config }),
  new AzureDevOpsProvider({ config }),
  new LocalProvider(),
];

export function getProvider(url: string): RepositoryProvider {
  for (const provider of providers) {
    if (provider.canHandle(url)) return provider;
  }
  throw new Error(`No provider found for URL/path: ${url}`);
}

export { GithubProvider, AzureDevOpsProvider, LocalProvider };
