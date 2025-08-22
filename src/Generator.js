/*
    Generator.js
    (c) 2013-2025 musictheory.net, LLC
    MIT license, http://www.opensource.org/licenses/mit-license.php

    Generates JavaScript or TypeScript from input code/AST/model.
*/

import { Modifier     } from "./Modifier.js";
import { Syntax       } from "./ast/Tree.js";
import { Traverser    } from "./ast/Traverser.js";
import { ScopeManager } from "./ScopeManager.js";
import { SymbolUtils  } from "./SymbolUtils.js";

import { Model         } from "./model/Model.js";
import { CompilerIssue } from "./model/CompilerIssue.js";

import path from "node:path";


export class Generator {


constructor(file, model, squeezer, options, forTypechecker)
{
    this._file     = file;
    this._model    = model;
    this._modifier = new Modifier(file.contents);
    this._squeezer = squeezer;
    this._options  = options;

    this._forTypechecker = !!forTypechecker;

    let inlines = new Map();
    let targetTags = new Map();

    for (let { name, raw } of model.globals.values()) {
        if (!inlines.has(name)) {
            inlines.set(name, raw);
        }
    }

    let additionalGlobals = options["additional-globals"];
    for (let [ key, value ] of additionalGlobals.entries()) {
        inlines.set(key, JSON.stringify(value));
    }

    this._inlines         = inlines;
    this._interceptors    = options["interceptors"];
    this._targetTags      = options["target-tags"];
    this._undefinedGuards = options["undefined-guards"];
}


generate()
{
    let traverser = new Traverser(this._file.ast);
    let scopeManager = this._file.scopeManager;

    let model        = this._model;
    let modifier     = this._modifier;
    let squeezer     = this._squeezer;
    let options      = this._options;
    let filePath     = this._file.path;

    let forTypechecker = this._forTypechecker;

    let inlines         = this._inlines;
    let interceptors    = this._interceptors;
    let targetTags      = this._targetTags;
    let undefinedGuards = this._undefinedGuards;
    
    let toSkip = new Set();

    let currentClass = null;
    let classStack = [ ];
    
    let currentIsStatic = null;
    let isStaticStack = [ ];

    let warnings = [ ];

    function checkRestrictedUsage(node)
    {
        let name = node.name;

        if (!node.nx_transformable) return;

        if (inlines.has(name)) {
            throw new CompilerIssue(`Cannot use compiler-inlined "${name}" here`, node);
        }
    }

    function shouldRemove(node)
    {
        let type = node.type;
        
        if (!forTypechecker && (
            type == Syntax.TSTypeAnnotation       ||
            type == Syntax.NXEnumDeclaration      ||
            type == Syntax.NXInterfaceDeclaration ||
            type == Syntax.NXTypeDeclaration
        )) {
            return true;
        }
    
        return false;
    }
    
    function handleRuntimeMemberExpression(node, parent)
    {
        let propertyName = node.property.name;

        let replaceParent = false; 
        let replacement   = null;
      
        // Nyx.getFuncIdentifier()
        if (propertyName == "getFuncIdentifier") {
            if (
                parent.type != Syntax.CallExpression ||
                parent.arguments.length != 1 ||
                parent.arguments[0].type != Syntax.Literal ||
                typeof parent.arguments[0].value !== "string"
            ) {
                throw new CompilerIssue(`Invalid use of Nyx.getFuncIdentifier`, node);
            }
            
            let funcString = parent.arguments[0].value;
            let funcComponents = SymbolUtils.fromFuncString(funcString);

            if (!funcComponents) {
                throw new CompilerIssue(`"${funcString}" is not a valid func signature.`, node);
            }

            let funcIdentifier = SymbolUtils.toFuncIdentifier(funcComponents);
            if (!funcIdentifier) {
                throw new CompilerIssue(`"${funcString}" has no named arguments.`, node);
            }

            if (squeezer) {
                funcIdentifier = squeezer.squeeze(funcIdentifier);
            }

            replaceParent = true;
            replacement = `"${funcIdentifier}"`;
        
        // Nyx.dispatchInit()        
        } else if (propertyName == "dispatchInit") {
            replacement = SymbolUtils.RootVariable + ".i";

        // Nyx.noInitSymbol
        } else if (propertyName == "noInitSymbol") {
            replacement = SymbolUtils.RootVariable + ".x";

        // Nyx.namedInitSymbol
        } else if (propertyName == "namedInitSymbol") {
            replacement = SymbolUtils.RootVariable + ".n";

        // Nyx.postInitSymbol
        } else if (propertyName == "postInitSymbol") {
            replacement = SymbolUtils.RootVariable + ".p";

        // Nyx.observerSymbol
        } else if (propertyName == "observerSymbol") {
            replacement = SymbolUtils.RootVariable + ".o";

        // Nyx.reportUndefined
        } else if (propertyName == "reportUndefined") {
            replacement = SymbolUtils.RootVariable + ".r";

        } else {
            throw new CompilerIssue(`Unknown runtime property: Nyx.${propertyName}`, node);
        }

        toSkip.add(node.object);
        toSkip.add(node.property);

        if (replaceParent && (parent.type == Syntax.CallExpression)) {
            parent.arguments.forEach(a => toSkip.add(a));
            modifier.replace(parent, replacement);
        } else {
            modifier.replace(node, replacement);
        }
    }
    
    function handleExportDeclaration(node)
    {
        if (shouldRemove(node.declaration)) {
            modifier.remove(node.start, node.declaration.start);

        } else if (!forTypechecker) {
            let exportedNames = [ ];

            if (node.declaration.type == Syntax.VariableDeclaration) {
                for (let declaration of node.declaration.declarations) {
                    exportedNames.push(declaration.id.name);
                }

            } else if (node.declaration.id) {
                exportedNames.push(node.declaration.id.name);
            }

            let replacement = exportedNames.map(name => {
                let lhs = SymbolUtils.getImportExpression(name, squeezer);
                return `${lhs} = ${name};`;
            });
            
            if (replacement) {
                modifier.replace(node.start, node.declaration.start, "");
                modifier.replace(node.declaration.end, node.end, replacement);
            }
        }
    }
    
    function handleClassDeclaration(node)
    {
        function isInitBased(cls) {
            if (cls.hasConstructor) return false;
            if (cls.hasFuncOrProp)  return true;
            
            return false;
        }

        classStack.push(currentClass);
        currentClass = node.nx_class;

        if (node.id) {
            toSkip.add(node.id);
        }

        if (node.nx_targetTag) {
            modifier.remove(node.nx_targetTag);
            toSkip.add(node.nx_targetTag);

            let targetTagValue = targetTags.get(node.nx_targetTag.name);
            
            if ((targetTagValue === false) && !forTypechecker) {
                modifier.replace(node, `const ${node.id.name} = undefined;`);
                toSkip.add(node.body);
                return;
            }
            
            if ((targetTagValue !== undefined) && forTypechecker) {
                modifier.replace(node.start, node.id.start, `const ${node.id.name} = N$F_Maybe(class`);
                modifier.replace(node.body.end, node.end, ")");
            }
        }

        if (!forTypechecker) {
            let rootVariable = SymbolUtils.RootVariable;

            let constructorText;
            
            if (isInitBased(currentClass)) {
                if (node.superClass) {
                    constructorText = [
                        "constructor(A, B, ...C) {",
                        `let x = ${rootVariable}.x;`,           // x = Nyx.noInitSymbol
                        `A == x || A == ${rootVariable}.n ?`,   // n = Nyx.namedInitSymbol
                        "super(x, B, ...C) : super(x, '', A, B, ...C);",
                        `${rootVariable}.i(this, A, B, ...C);`,
                        "}"
                    ].join("");
                
                } else {
                    constructorText = `constructor(...A) { ${rootVariable}.i(this, ...A); }`;
                }
            }
            
            if (undefinedGuards.has("init") && currentClass.getProps().size) {
                let className = currentClass.name;
                if (squeezer) {
                    className = SymbolUtils.getDebugIdentifier(className, squeezer);
                }
            
                let initGuardText = [
                    `[${rootVariable}.g]() {`, // g = afterInitCheckSymbol
                    node.superClass ? `super[${rootVariable}.g]?.();` : "",
                    `${rootVariable}.gi("${className}", [`, // gi = afterInitCheck

                    Array.from(currentClass.getProps()).sort().map(name => {
                        let propertyName = name;
                        let backingName  = `#${name}`;

                        if (squeezer) {
                            propertyName = squeezer.squeeze(propertyName);
                        }
                        
                        return `"${propertyName}",this.${backingName}`
                    }).join(","),

                    `])}`,
                ].join("");
            
                constructorText = (constructorText ?? "") + initGuardText;
            }

            if (constructorText) {
                modifier.replace(node.body.start, node.body.body[0].start, `{${constructorText}`);
            }
        }
    }

    function handlePropertyDefinition(node)
    {
        if (!forTypechecker) {
            if (node.readonly) {
                let replacement = node.static ? "static" : "";
                modifier.replace(node.start, node.key.start, replacement);                
            }            
        }
    }

    function handleMethodDefinition(node)
    {
        isStaticStack.push(currentIsStatic);
        currentIsStatic = node.static;
        
        if (forTypechecker) {
            if (node.kind == "set" && node.value.annotation) {
                // Allow "void" annotation on setter
                if (node.value.annotation?.value?.name?.name == "void") {
                    modifier.remove(node.value.annotation);
                    toSkip.add(node.value.annotation);
                }
            }
        }
    }

    function handleImportDeclaration(node)
    {
        let specifiers = node.specifiers;
        let length = specifiers.length;

        let replacements = [ ];
        
        for (let i = 0; i < length; i++) {
            let specifier = specifiers[i];

            let name = specifier.imported.name;
            let declaration = scopeManager.getImport(name);
                
            if (!declaration) {
                warnings.push(new CompilerIssue(`Unknown import: "${name}"`, specifier));
                continue;
            }
            
            if (declaration.object instanceof Model.Runtime) {
                continue                
            }

            if (forTypechecker) {
                let toPath = declaration.object?.location?.path;

                if (!toPath) {
                    warnings.push(new CompilerIssue(`No known path for: "${name}"`, specifier));
                    continue;
                }
                
                let importPath = path.relative(path.dirname(filePath), toPath);
                replacements.push(`import { ${name} } from "${importPath}";`);
            
            } else if (declaration.importType == ScopeManager.ImportType.Past) {
                let expression = SymbolUtils.getImportExpression(name, squeezer);
                replacements.push(`${name} = ${expression}`);
            }
        }

        let replacement = "";
        
        if (replacements.length) {
            replacement = forTypechecker ?
            replacements.join("") :
            `const ${replacements.join(",")};`
        }

        modifier.replace(node, replacement);
    }
   
    function handleCallExpression(node)
    {
        let funcName = node.nx_func;
        let baseNode = node.nx_base;

        if (funcName) {
            if (squeezer) {
                funcName = squeezer.squeeze(funcName);
            }

            modifier.replace(baseNode, funcName);

            toSkip.add(baseNode);
            
            for (let argument of node.arguments) {
                if (argument.type === Syntax.NXNamedArgument) {
                    modifier.remove(argument.name);
                    modifier.remove(argument.colon);

                    toSkip.add(argument.name);
                }
            }
        }
    }

    function handleNewExpression(node)
    {
        for (let argument of node.arguments) {
            if (argument.type === Syntax.NXNamedArgument) {
                modifier.remove(argument.name);
                modifier.remove(argument.colon);

                toSkip.add(argument.name);
            }
        }

        let funcName = node.nx_func;

        if (funcName) {
            if (squeezer) {
                funcName = squeezer.squeeze(funcName);
            }

            if (forTypechecker) {
                let replacement = `()).${funcName}(`;
            
                modifier.replace(node.start, node.callee.start, "((new ");
                modifier.replace(node.callee.end, node.arguments[0].start, replacement);

                modifier.replace(node.arguments[node.arguments.length - 1].end, node.end, "))");

            } else {
                let replacement = `(${SymbolUtils.RootVariable}.n, "${funcName}", `;
                
                modifier.replace(node.callee.end, node.arguments[0].start, replacement);
            }
        }
    }

    function handleTaggedTemplateExpression(node)
    {
        if (node.tag.type != Syntax.Identifier) return;

        let tagName = node.tag.name;
        let interceptor = interceptors.get(tagName);
        if (!interceptor) return;
        
        if (!forTypechecker) {
            let quasi = node.quasi;
            let elements  = quasi.quasis;
            let inStrings = elements.map(element => element.value.raw);
            
            let outStrings;

            try {
                outStrings = interceptor(inStrings);
            } catch (e) {
                let issue = new CompilerIssue(e.toString(), node);
                issue.cause = e;
                throw issue;
            }
            
            let inLength = inStrings.length;
            let outLength = outStrings.length;
            
            if (inLength != outLength) {
                throw new CompilerIssue(
                    `Interceptor '${tagName}' string count mismatch. ${outLength} vs. ${inLength}`,
                    node
                );
            }
            
            // Convert to double quote if possible
            if (outLength == 1 && !outStrings[0].match(/["]/)) {
                modifier.replace(quasi, `"${outStrings[0]}"`);

            } else {
                for (let i = 0; i < elements.length; i++) {
                    let element = elements[i];
                    modifier.replace(element, outStrings[i]);
                    toSkip.add(element);
                }
            }
        }

        modifier.remove(node.tag);
        toSkip.add(node.tag);
    }

    function handleIdentifier(node, parent)
    {
        let name = node.name;

        if (name[0] === "N" && name[1] === "$") {
            throw new CompilerIssue(`Identifiers may not start with "N$"`, node);
        }

        let replacement;

        let isParentProperty = (
            parent.type == Syntax.Property ||
            parent.type == Syntax.MethodDefinition ||
            parent.type == Syntax.PropertyDefinition ||
            parent.type == Syntax.MemberExpression ||
            parent.type == Syntax.TSObjectMember
        );

        // Special case: handle shorthand syntax
        if (parent.type == Syntax.Property && parent.shorthand) {
            if (node == parent.key && squeezer) {
                let squeezedName = squeezer.squeeze(name);
                replacement = `${squeezedName}: ${name}`;
            }
        }

        // Squeeze if needed
        if (
            !replacement && 
            isParentProperty &&
            !parent.computed &&
            (node == parent.key || node == parent.property)
        ) {
            if (squeezer) replacement = squeezer.squeeze(name);
        }
        
        // Imports
        if (!replacement) {
            let scopeDeclaration = scopeManager.getValue(name);

            if (
                !forTypechecker &&
                scopeDeclaration?.importType == ScopeManager.ImportType.Future
            ) {
                replacement = SymbolUtils.getImportExpression(name, squeezer);
            }
        }

        // Prop Shortcuts
        if (!replacement && (name[0] == "_") && currentIsStatic === false && currentClass) {
            let propName = name.slice(1);
    
            if (currentClass.hasProp(propName)) {
                replacement = `this.#${propName}`;
            }
        }

        // Inlines
        if (!replacement && inlines.has(name)) {
            replacement = inlines.get(name);
        }
        
        if (replacement) {
            modifier.replace(node, replacement);

            if (node.annotation) toSkip.add(node.annotation);
            if (node.question)   toSkip.add(node.question);
        } else {
            if (node.question && !forTypechecker) {
                modifier.remove(node.question)
                toSkip.add(node.question);
            }
        }
    }

    function handleMemberExpression(node, parent)
    {
        if (node.computed || node.object.type !== Syntax.Identifier) {
            return;
        }

        let object = scopeManager.getValue(node.object.name)?.object;

        if (object instanceof Model.Enum) {
            if (node.property.type !== Syntax.Identifier) {
                warnings.push(new CompilerIssue(`enum member must be an identifier`, node));
                return;
            }

            let nsEnum = object;
            let memberName = node.property.name;
            let member = nsEnum.members.get(memberName);

            if (member) {
                toSkip.add(node.object);
                toSkip.add(node.property);

                let replacement;
                if (forTypechecker) {
                    replacement = nsEnum.name + "." + member.name;
                } else {
                    if (typeof member.value == "string") {
                        replacement = `"${member.value}"`;
                    } else {
                        replacement = "" + member.value;
                    }
                
                    modifier.replace(node, replacement);
                }

            } else {
                warnings.push(new CompilerIssue(`Unknown enum member '${memberName}'`, node.property));
            }

        } else if (object instanceof Model.Runtime) {
            handleRuntimeMemberExpression(node, parent);
        }
    }

    function handleVariableDeclaration(node, parent)
    {
        for (let declaration of node.declarations) {
            checkRestrictedUsage(declaration.id);
        }
    }

    function handleNXAsExpression(node)
    {
        if (!forTypechecker) {
            modifier.remove(node.expression.end, node.annotation.start);
        }
    }

    function handleNXNonNullExpression(node)
    {
        if (!forTypechecker) {
            modifier.remove(node.expression.end, node.end);
        }
    }

    function handleTSTypeAnnotation(node, parent)
    {
        if (!forTypechecker) {
            modifier.remove(node);
            toSkip.add(node.value);
        }
    }

    function handleNXNullableType(node, parent)
    {
        let rightString = " | null)";

        if (parent.type === Syntax.TSTupleType) {
            rightString += "?";
        }
    
        modifier.insert(node.start, "(");
        modifier.replace(node.argument.end, node.end, rightString);
    }

    function handleNXGlobalDeclaration(node)
    {
        let declaration = node.declaration;

        modifier.remove(node);
        toSkip.add(declaration);
    }

    function handleFunctionDeclarationOrExpression(node)
    {
        let params = node.params;

        // Remove "this" parameter when generating non-TypeScript
        if (!forTypechecker && (params[0]?.name == "this")) {
            modifier.remove(params[0].start, params[1]?.start ?? params[0].end);
            toSkip.add(params[0]);
        }

        for (let param of params) {
            checkRestrictedUsage(param);
        }
    }

    function handleNXPropDefinition(node)
    {
        let name = node.key.name;

        let rootVariable = SymbolUtils.RootVariable;

        let isPrivate   = (node.modifier == "private");
        let isReadOnly  = (node.modifier == "readonly");
        let wantsGetter =  !isPrivate;
        let wantsSetter = (!isPrivate && !isReadOnly);

        let propertyName = name;
        let backingName  = `#${name}`;

        if (squeezer) {
            propertyName = squeezer.squeeze(propertyName);
        }
        
        if (node.static) {
            throw new CompilerIssue("static cannot be used with prop.", node);
        }

        if (currentClass.hasField(backingName, false)) {
            throw new CompilerIssue(`Backing field '${backingName}' already declared`, node);
        }

        let isObserved = false;
        let observerArg = "";
        if (node.observer) {
            observerArg = options["observers"].get(node.observer.name);

            if (observerArg === undefined) {
                throw new CompilerIssue(`Unknown observer: @${node.observer.name}`, node);
            }
            
            observerArg = JSON.stringify(observerArg);
            isObserved = true;
        }
    
        //          prop foo                             ;
        //          prop foo         = "foo"             ;
        // readonly prop foo: string = "foo"             ;
        // ^---------------^                ^-----------^
        //  replaced with leftString        replaced with rightString
        
        let leftString  = "";
        let rightString = ";";

        let annotation = "";

        if (forTypechecker) {
            let typePlaceholder = SymbolUtils.getTypePlaceholder(propertyName, squeezer);

            annotation = `: typeof this.${typePlaceholder}`;
            
            leftString  += `${typePlaceholder}`;
            rightString += ` ${backingName}${annotation}`;
            rightString += node.value ? ` = this.${typePlaceholder};` : ";";

        } else {
            leftString += `${backingName}`;
        }

        if (wantsSetter && !currentClass.hasSetter(name, false)) {
            let s = [ ];

            if (isObserved) {
                s.push(`if (this.${backingName} !== arg) {`);
            }

            s.push(`this.${backingName} = arg;`);

            if (isObserved) {
                let observerSymbol = SymbolUtils.RootVariable + ".o";
                s.push(`this[${observerSymbol}](${observerArg});`);
                s.push(`}`);
            }

            if (undefinedGuards.has("set")) {
                s.push(`${rootVariable}.gs("${propertyName}", arg);`);
            }

            rightString += ` set ${propertyName}(arg${annotation}) { ${s.join(" ")} }`;
        }
            
        if (wantsGetter && !currentClass.hasGetter(name, false)) {
            let g = [ ];

            if (undefinedGuards.has("get")) {
                g.push(`${rootVariable}.gg("${propertyName}", this.${backingName});`);
            }

            g.push(`return this.${backingName};`);

            rightString += ` get ${propertyName}()${annotation} { ${g.join(" ")} }`;
        }
        
        let rightmostNode = node.value ?? node.annotation ?? node.key;
        
        modifier.replace(node.start, node.key.end, leftString);
        modifier.replace(rightmostNode.end, node.end, rightString);

        toSkip.add(node.key);
        
        if (!forTypechecker && node.annotation) {
            modifier.remove(node.annotation);    
            toSkip.add(node.annotation);    
        }
    }

    function handleNXFuncDefinition(node)
    {
        let isStatic = node.static;
        let baseName = node.key.name;

        isStaticStack.push(currentIsStatic);
        currentIsStatic = isStatic;

        if (node.targetTag) {
            let targetTagValue = targetTags.get(node.targetTag.name);
            
            if ((targetTagValue === false) && !forTypechecker) {
                modifier.remove(node);
                return Traverser.SkipNode;
            }
            
            modifier.remove(node.targetTag);
            toSkip.add(node.targetTag);
        }
    
        if (forTypechecker && baseName == "init") {
            if (node.annotation) {
                modifier.remove(node.annotation);
                toSkip.add(node.annotation);
            }
            
            let bodyNodes = node.body.body;
            if (bodyNodes.length > 0) {
                modifier.insert(bodyNodes[bodyNodes.length - 1].end, " return this;");
            } else {
                modifier.replace(node.body, "{ return this; }");
            }
        }

        modifier.replace(node.start, node.key.start, isStatic ? "static " : "");
        
        let funcName = node.nx_func;
        let keyReplacement = funcName ?? baseName;
        
        if (squeezer) {
            keyReplacement = squeezer.squeeze(keyReplacement);
        }
        
        if (keyReplacement != baseName) {
            modifier.replace(node.key, keyReplacement);
            toSkip.add(node.key);
        }
    }

    function handleNXFuncParameter(node)
    {
        if (node.label) {
            modifier.remove(node.label);
            toSkip.add(node.label);
        }
    }

    traverser.traverse(function(node, parent) {
        let type = node.type;

        if (toSkip.has(node)) return Traverser.SkipNode;

        if (shouldRemove(node)) {
            modifier.remove(node);
            return Traverser.SkipNode;
        }

        scopeManager.reenterNode(node);

        if (type === Syntax.ImportDeclaration) {
            handleImportDeclaration(node);
            if (!forTypechecker) return Traverser.SkipNode;

        } else if (type === Syntax.ExportNamedDeclaration) {
            handleExportDeclaration(node);

        } else if (type === Syntax.ClassDeclaration || type == Syntax.ClassExpression) {
            handleClassDeclaration(node);
        
        } else if (type === Syntax.CallExpression) {
            handleCallExpression(node);

        } else if (type === Syntax.NewExpression) {
            handleNewExpression(node);

        } else if (type === Syntax.TaggedTemplateExpression) {
            handleTaggedTemplateExpression(node);

        } else if (type === Syntax.NXAsExpression) {
            handleNXAsExpression(node);

        } else if (type === Syntax.NXNonNullExpression) {
            handleNXNonNullExpression(node);

        } else if (type === Syntax.TSTypeAnnotation) {
            handleTSTypeAnnotation(node, parent);

        } else if (type === Syntax.NXNullableType) {
            handleNXNullableType(node, parent);

        } else if (type === Syntax.NXGlobalDeclaration) {
            handleNXGlobalDeclaration(node);

        } else if (type === Syntax.Identifier) {
            handleIdentifier(node, parent);

        } else if (type === Syntax.MemberExpression) {
            handleMemberExpression(node, parent);

        } else if (type === Syntax.VariableDeclaration) {
            handleVariableDeclaration(node);

        } else if (type === Syntax.FunctionDeclaration || type === Syntax.FunctionExpression || type === Syntax.ArrowFunctionExpression) {
            handleFunctionDeclarationOrExpression(node);

        } else if (type === Syntax.PropertyDefinition) {
            handlePropertyDefinition(node);

        } else if (type === Syntax.MethodDefinition) {
            handleMethodDefinition(node);

        } else if (type === Syntax.NXPropDefinition) {
            handleNXPropDefinition(node);

        } else if (type === Syntax.NXFuncDefinition) {
            return handleNXFuncDefinition(node);

        } else if (type === Syntax.NXFuncParameter) {
            handleNXFuncParameter(node);
        }

        
    }, function(node, parent) {
        let type = node.type;
        
        scopeManager.exitNode(node);

        if (type === Syntax.ClassDeclaration || type === Syntax.ClassExpression) {
            currentClass = classStack.pop();
        } else if (type === Syntax.MethodDefinition || type === Syntax.NXFuncDefinition) {
            currentIsStatic = isStaticStack.pop();
        }
    });

    for (let warning of warnings) {
        warning.addFile(filePath);
    }

    let lines = modifier.finish().split("\n");

    if (lines.length && !forTypechecker) {
        lines[0] = `(function(){ "use strict";` + lines[0];
        lines[lines.length - 1] += "})();";    
    }
    
    return { lines, warnings };
}

}
