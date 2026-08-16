const { Project, SyntaxKind } = require("ts-morph");

const project = new Project({
    tsConfigFilePath: "./tsconfig.json",
});

project.addSourceFilesAtPaths("src/**/*.tsx");

let modifiedFiles = 0;

for (const sourceFile of project.getSourceFiles()) {
    let modified = false;
    let needsHook = false;
    
    // 1. Remove static `formatCurrency` imports and mark `needsHook`
    const importDecls = sourceFile.getImportDeclarations();
    for (const decl of importDecls) {
        if (decl.getModuleSpecifierValue().includes("lib/utils")) {
            const namedImports = decl.getNamedImports();
            const formatCurrencyImport = namedImports.find(ni => ni.getName() === "formatCurrency");
            if (formatCurrencyImport) {
                formatCurrencyImport.remove();
                needsHook = true;
                modified = true;
                if (decl.getNamedImports().length === 0) {
                    decl.remove();
                }
            }
        }
    }

    // 2. Check for hardcoded symbols
    const hasSymbols = /[\$₹]/.test(sourceFile.getFullText());
    if (hasSymbols) {
        needsHook = true;
    }

    if (needsHook) {
        // Ensure useCurrency is imported
        const hasUseCurrencyImport = sourceFile.getImportDeclarations().some(d => d.getModuleSpecifierValue() === "@/hooks/use-currency");
        if (!hasUseCurrencyImport) {
            sourceFile.addImportDeclaration({
                namedImports: ["useCurrency"],
                moduleSpecifier: "@/hooks/use-currency"
            });
            modified = true;
        }

        // Find main component
        let mainBlock = null;
        const functions = sourceFile.getFunctions();
        const mainFunction = functions.find(f => f.isExported() && /^[A-Z]/.test(f.getName()));
        if (mainFunction) {
            mainBlock = mainFunction.getBody();
        } else {
            const varDecls = sourceFile.getVariableDeclarations();
            const mainVarDecl = varDecls.find(v => {
                const name = v.getName();
                return name && /^[A-Z]/.test(name) && v.getInitializer()?.getKind() === SyntaxKind.ArrowFunction;
            });
            if (mainVarDecl) {
                const init = mainVarDecl.getInitializer();
                if (init.getKind() === SyntaxKind.ArrowFunction) {
                    mainBlock = init.getBody();
                }
            }
        }

        if (mainBlock && mainBlock.getKind() === SyntaxKind.Block) {
            const bodyText = mainBlock.getText();
            if (!bodyText.includes("useCurrency(")) {
                mainBlock.insertStatements(0, "const { currency, formatCurrency } = useCurrency();");
                modified = true;
            }
        }

        // Now replace JSX texts and string literals carefully
        sourceFile.forEachDescendant(node => {
            if (node.getKind() === SyntaxKind.JsxText) {
                const text = node.getText();
                if (/([\$₹])/.test(text)) {
                    const newText = text.replace(/[\$₹]\s*/g, "{currency.symbol}");
                    if (newText !== text) {
                        try {
                            node.replaceWithText(newText);
                            modified = true;
                        } catch (e) {}
                    }
                }
            } else if (node.getKind() === SyntaxKind.TemplateHead || node.getKind() === SyntaxKind.TemplateMiddle || node.getKind() === SyntaxKind.TemplateTail || node.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral) {
                const text = node.getText();
                if (/([\$₹])/.test(text)) {
                    const newText = text.replace(/[\$₹]\s*/g, "${currency.symbol}");
                    if (newText !== text) {
                        try {
                            node.replaceWithText(newText);
                            modified = true;
                        } catch (e) {}
                    }
                }
            }
        });
    }

    if (modified) {
        sourceFile.saveSync();
        modifiedFiles++;
        console.log("Updated", sourceFile.getBaseName());
    }
}

console.log(`Refactored ${modifiedFiles} files.`);
