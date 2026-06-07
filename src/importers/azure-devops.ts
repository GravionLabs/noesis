import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";

export class AzureDevopsImporter implements Importer {
  readonly type = "azuredevops";

  async import(_source: Source): Promise<ImportResult> {
    throw new Error("Azure DevOps importer not yet implemented");
  }
}
