/**
 * CLI for repo analysis - generates llms.txt from repositories.
 */

import { analyzeRepository } from "./repo-analyzer.js";
import { promises as fs } from "fs";
import path from "path";

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: npx tsx repo-analyzer-cli.ts <repo-url> <output-file>");
    console.error("Examples:");
    console.error("  npx tsx repo-analyzer-cli.ts https://github.com/owner/repo ./llms-full.txt");
    console.error("  npx tsx repo-analyzer-cli.ts https://dev.azure.com/org/proj/_git/repo ./llms-full.txt");
    console.error("  npx tsx repo-analyzer-cli.ts ./local/repo ./llms-full.txt");
    process.exit(1);
  }

  const repoUrl = args[0];
  const outputFile = args[1];

  try {
    console.log(`\n📊 Analyzing repository: ${repoUrl}\n`);

    const result = await analyzeRepository(repoUrl, {
      useEmbeddings: true,
      embeddingModel: "bge-large-en-v1.5",
      includeStructure: true,
      includeReadme: true,
      includeDocumentation: true,
      includeApis: true,
    });

    // Write output
    const outputDir = path.dirname(outputFile);
    if (outputDir !== ".") {
      await fs.mkdir(outputDir, { recursive: true });
    }

    await fs.writeFile(outputFile, result.llmsTxt, "utf-8");
    console.log(`✅ Successfully wrote ${outputFile}\n`);
    console.log(`📦 Summary:`);
    console.log(`   - Repo: ${result.repoUrl}`);
    console.log(`   - Docs: ${result.documentationFiles.length} files`);
    console.log(`   - Output: ${outputFile}\n`);
  } catch (error) {
    console.error(`\n❌ Error: ${error}\n`);
    process.exit(1);
  }
}

main();
