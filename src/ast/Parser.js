/*
    Parser.js
    (c) 2024-2025 musictheory.net, LLC
    MIT license, http://www.opensource.org/licenses/mit-license.php

    Nyx extensions to acorn's parser.
*/

import {
    tokTypes as tt,
    lineBreak,
    TokenType, isIdentifierStart
} from "acorn";

import { Syntax } from "./Tree.js";
import { TypeParser } from "./TypeParser.js";


tt.atId = new TokenType("atId", { startsExpr: true });


// From acorn, used by parseClassElement()
function checkKeyName(node, name)
{
    const key = node.key;

    return !node.computed && (
        key.type === Syntax.Identifier && key.name  === name ||
        key.type === Syntax.Literal    && key.value === name
    )
}


export class Parser extends TypeParser {

#newTypeParametersRefStack = [ ];


static parse(contents, options)
{
    return super.parse(contents, options ?? {
        ecmaVersion: 2022,
        sourceType: "module",
        locations: true,
        checkPrivateFields: false
    });
}


saveState()
{
    return {
        pos: this.pos,
        type: this.type,
        start: this.start,
        end: this.end,
        value: this.value,
        startLoc: this.startLoc,
        endLoc: this.endLoc,
        lastTokStart: this.lastTokStart,
        lastTokEnd: this.lastTokEnd,
        lastTokStartLoc: this.lastTokStartLoc,
        lastTokEndLoc: this.lastTokEndLoc,
        context: this.context.slice(0),
        exprAllowed: this.exprAllowed,
        lineStart: this.lineStart,
        curLine: this.curLine
    };
}


restoreState(state)
{
    Object.assign(this, state);
}


readToken(code)
{
    if (isIdentifierStart(code, true) || code === 92 /* '\' */) {
        return this.readWord()
    } else if (code === 64) {
        return this.nxReadToken_at();
    }
    
    return this.getTokenFromCode(code)
}


parseBindingAtom()
{
    let result;

    // Allow 'this' as parameter name
    if (this.type == tt._this) {
        result = this.parseIdent(true);
    } else {
        result = super.parseBindingAtom();
    }

    if (result.type == Syntax.Identifier) {
        if (this.type == tt.question && this.nxAllowOptionalIdent) {
            result.optional = true;
            result.question = this.nxParsePunctuation();

            this.finishNode(result, Syntax.Identifier);
        }

        if (this.type == tt.colon) {
            result.typeAnnotation = this.tsParseTypeAnnotation();
            this.finishNode(result, Syntax.Identifier);
        }
    }

    return result;
}


parseClassId(node, isStatement)
{
    if (!isStatement && this.isContextual("implements")) {
        return;
    }

    super.parseClassId(node, isStatement);

    node.typeParameters = this.tsTryParseTypeParameters("inout");
}


parseClassField(node)
{
    // check for optional, if in interface
    // check for colon and parse type
    if (this.nxInInterface && this.eat(tt.question)) {
        node.optional = true;
        
        if (this.type == tt.parenL) {
            super.parseClassMethod(node, false, false, false);
            return;
        }
    }

    if (this.type == tt.colon) {
        node.typeAnnotation = this.tsParseTypeAnnotation();
    }

    super.parseClassField(node);
}


parseClassSuper(node)
{
    super.parseClassSuper(node);
    
    if (node.superClass && this.tsMatchLeftRelational()) {
        node.superTypeParameters = this.tsParseTypeArguments();
    }

    if (this.eatContextual("implements")) {
        node.implements = this.tsParseHeritageClause("implements");
    }
}
            

parseClassMethod(method, isGenerator, isAsync, allowsDirectSuper)
{
    if (this.nxInInterface) {
        method.optional = this.eat(tt.question);
    }

    let typeParameters = this.tsTryParseTypeParameters("const");

    let result = super.parseClassMethod(method, isGenerator, isAsync, allowsDirectSuper);

    if (typeParameters) {
        result.value.typeParameters = typeParameters;
    }

    return result;
}


parseMethod(isGenerator, isAsync, allowDirectSuper)
{
    let previousAllowOptionalIdent = this.nxAllowOptionalIdent;
    this.nxAllowOptionalIdent = true;

    let result = super.parseMethod(isGenerator, isAsync, allowDirectSuper);
    
    this.nxAllowOptionalIdent = previousAllowOptionalIdent

    return result;
}


parseFunctionParams(node)
{
    let previousAllowOptionalIdent = this.nxAllowOptionalIdent;
    this.nxAllowOptionalIdent = true;
    
    node.typeParameters = this.tsTryParseTypeParameters("const");
    super.parseFunctionParams(node);
    
    this.nxAllowOptionalIdent = previousAllowOptionalIdent
}


shouldParseExportStatement()
{
    return (
        this.type == tt.atId || // Allow export @targetTag
        this.isContextual("enum") ||
        this.isContextual("type") ||
        this.isContextual("interface") ||
        super.shouldParseExportStatement()
    );
}


parseImport(node)
{
    this.next()

    if (this.type === tt.string) {
        node.specifiers = [ ];
        node.source = this.parseExprAtom();

    } else {
        node.specifiers = this.parseImportSpecifiers();

        if (this.eatContextual("from")) {
            node.source = this.type === tt.string ? this.parseExprAtom() : this.unexpected();
        }
    }

    this.semicolon();

    return this.finishNode(node, Syntax.ImportDeclaration);
}


parseFunctionBody(node, isArrowFunction, isMethod, forInit)
{
    if (this.type == tt.colon) {
        node.returnType = this.tsParseReturnType();
    }
    
    // Allow body-less functions and methods
    if (!isArrowFunction && (this.type !== tt.braceL)) {
        this.exitScope();
    } else {
        super.parseFunctionBody(node, isArrowFunction, isMethod, forInit);
    }
}


parseParenItem(item)
{
    let result = super.parseParenItem(item);

    if (this.type == tt.colon) {
        result.typeAnnotation = this.tsParseTypeAnnotation();
    }

    return result;
}


parseNew()
{
    this.#newTypeParametersRefStack.push({ });

    let result = super.parseNew();

    let typeParametersRef = this.#newTypeParametersRefStack.pop();
    if (typeParametersRef !== undefined) {
        result.typeParameters = typeParametersRef.value;
    }

    return result;
}


parseSubscript(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit)
{
    if (
        this.value == "!" &&
        this.type == tt.prefix &&
        !this.tsHasPrecedingLineBreak()
    ) {
        const node = this.startNodeAt(startPos, startLoc);

        node.expression = base;
        this.next();

        return this.finishNode(node, Syntax.NXNonNullExpression);
    }

    // We currently only support type parameters as arguments to a
    // NewExpression with an Identifier 'callee':
    //
    // new Identifier<string>(
    //  
    if (this.#newTypeParametersRefStack.length) {
        let typeParametersRef = this.#newTypeParametersRefStack.at(-1);

        if (
            base.type === Syntax.Identifier &&
            this.tsMatchLeftRelational() &&
            typeParametersRef !== undefined &&
            typeParametersRef.typeParameter === undefined
        ) {
            let state = this.saveState();

            typeParametersRef.value = this.tsTryParseTypeParameters();
            
            if (this.type !== tt.parenL) {
                typeParametersRef.value = null;
                this.restoreState(state);
            }
        }
    }

    return super.parseSubscript(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit);
}


parseExprList(close, allowTrailingComma, allowEmpty, refDestructuringErrors)
{
    let elts = [], first = true;

    while (!this.eat(close)) {
        if (!first) {
            this.expect(tt.comma);
            if (allowTrailingComma && this.afterTrailingComma(close)) break;
        } else {
            first = false;
        }

        let elt;
        if (allowEmpty && this.type === tt.comma) {
            elt = null;
        } else if (this.type === tt.ellipsis) {
            elt = this.parseSpread(refDestructuringErrors);

            if (refDestructuringErrors && this.type === tt.comma && refDestructuringErrors.trailingComma < 0) {
                refDestructuringErrors.trailingComma = this.start;
            }

        } else {
            if (close == tt.parenR && ((this.type == tt.name) || this.type.keyword)) {
                const namedArgument = this.startNode();

                let state = this.saveState();
                let name = this.parseIdent(true);
                
                if (this.type == tt.colon) {
                    namedArgument.name = name;
                    namedArgument.colon = this.nxParsePunctuation();
                    namedArgument.argument = this.parseMaybeAssign(false, refDestructuringErrors);

                    elt = this.finishNode(namedArgument, Syntax.NXNamedArgument);

                } else {
                    this.restoreState(state);
                    elt = this.parseMaybeAssign(false, refDestructuringErrors);
                }
            
            } else {
                elt = this.parseMaybeAssign(false, refDestructuringErrors);
            }
        }

        elts.push(elt);
    }

    return elts;
}


parseExprOp(left, leftStartPos, leftStartLoc, minPrec, forInit)
{
    if (
        (tt._in.binop > minPrec) &&
        this.isContextual("as") &&
        !this.tsHasPrecedingLineBreak()
    ) {
        const node = this.startNodeAt(leftStartPos, leftStartLoc);
        
        node.expression = left;
        this.expectContextual("as");
        node.typeAnnotation = this.tsParseTypeAnnotation(false);

        // See reScan_lt_gt() in acorn-typescript
        if (this.type === tt.relational) {
            this.pos -= 1;
            this.readToken_lt_gt(this.fullCharCodeAtPos());
        }
        
        this.finishNode(node, Syntax.NXAsExpression);
        
        return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec, forInit);

    } else {
        return super.parseExprOp(left, leftStartPos, leftStartLoc, minPrec, forInit);
    }
}


nxReadToken_at() // '@'
{
    ++this.pos;
    let code = this.fullCharCodeAtPos();

    if (isIdentifierStart(code, true) || code === 92 /* '\' */) {
        return this.finishToken(tt.atId, this.readWord1())
    }

    this.raise(this.pos, "Unexpected character '" + String.fromCharCode(code) + "'")
}


nxParsePunctuation()
{
    const node = this.startNode();
    this.next();
            
    return this.finishNode(node, Syntax.NXPunctuation);
}
 

nxMaybeParseTypeDefinition()
{
    const state = this.saveState();
    
    const node = this.startNode();
    const params = [];

    this.expectContextual("type");
    
    if (this.type != tt.name) {
        this.restoreState(state);
        return null;
    }

    node.id = this.parseIdent();
    node.typeParameters = this.tsTryParseTypeParameters("inout");
    
    this.expect(tt.eq);
    
    node.typeAnnotation = this.tsParseTypeAnnotation(false);

    this.semicolon();

    return this.finishNode(node, Syntax.NXTypeDeclaration);
}


nxMaybeParseGlobalDefinition()
{
    const state = this.saveState();
    
    const node = this.startNode();
    const declarations = [];

    this.expectContextual("global");

    if (this.type != tt.name) {
        this.restoreState(state);
        return null;
    }
    
    for (;;) {
        let decl = this.startNode()
        decl.id = this.parseIdent();
        if (this.eat(tt.eq)) {
            decl.init = this.parseMaybeAssign();
        } else {
            this.raise(this.lastTokEnd, "Missing initializer in global declaration");
        }
        declarations.push(this.finishNode(decl, "VariableDeclarator"))
        if (!this.eat(tt.comma)) break
    }

    node.declarations = declarations;

    this.semicolon();

    return this.finishNode(node, Syntax.NXGlobalDeclaration);
}


nxParseEnumMember()
{
    const node = this.startNode();
    node.id   = this.parseIdent();
    node.init = null;

    if (this.eat(tt.eq)) {
        node.init = this.parseMaybeAssign();
    }

    return this.finishNode(node, Syntax.NXEnumMember);
}


nxMaybeParseEnumDeclaration()
{
    const state = this.saveState();
    
    const node = this.startNode();

    this.expectContextual("enum");

    if (this.type != tt.name) {
        this.restoreState(state);
        return null;
    }

    node.id = this.parseIdent();
    node.members = [];

    this.expect(tt.braceL);
    
    while (!this.eat(tt.braceR)) {
        node.members.push(this.nxParseEnumMember());
        if (this.type != tt.braceR) this.expect(tt.comma);
    }

    this.semicolon();

    return this.finishNode(node, Syntax.NXEnumDeclaration);
}


nxParseAtIdentifier()
{
    const node = this.startNode();
    node.name = this.value;
    this.next();
    return this.finishNode(node, Syntax.NXAtIdentifier);
}


nxMaybeParseInterfaceDeclaration()
{
    const state = this.saveState();

    const node = this.startNode();

    this.expectContextual("interface");
    
    if (this.type != tt.name) {
        this.restoreState(state);
        return null;
    }

    let previousInInterface = this.nxInInterface;
    this.nxInInterface = true;

    const previousStrict = this.strict;
    this.strict = true;
      
    node.id = this.parseIdent();
    node.typeParameters = this.tsTryParseTypeParameters("inout");
    
    if (this.eat(tt._extends)) {
        node.extends = this.tsParseHeritageClause("extends");
    }
    
    let interfaceBody = this.startNode();
    interfaceBody.body = [ ];

    this.expect(tt.braceL);

    while (this.type !== tt.braceR) {
        let element = this.parseClassElement(false);
        if (element) {
            interfaceBody.body.push(element);
        }
    }

    this.next();

    node.body = this.finishNode(interfaceBody, Syntax.NXInterfaceBody);

    this.nxInInterface = previousInInterface;
    this.strict = previousStrict;

    return this.finishNode(node, Syntax.NXInterfaceDeclaration);
}
    

parseClassElement(constructorAllowsSuper)
{
    if (this.eat(tt.semi)) return null;

    const node = this.startNode();

    let keyName = "";
    let kind = "method";

    let isStatic    = false;
    let isAsync     = false;
    let isFunc      = false;
    let isGenerator = false;

    let readonlyStart = null;
    let privateStart  = null;

    const disallowReadonly = () => {
        if (readonlyStart !== null) {
            this.raise(readonlyStart, "'readonly' modifier can only appear on a property declaration or prop.");    
        }
    }

    const disallowPrivate = () => {
        if (privateStart !== null) {
            this.raise(privateStart, "'private' modifier can only appear on a prop.");    
        }
    }

    let atIdentifier = (this.type == tt.atId) ? this.nxParseAtIdentifier() : null;

    if (this.eatContextual("static")) {
        if (this.eat(tt.braceL)) {
            this.parseClassStaticBlock(node);
            return node;
        }

        if (this.isClassElementNameStart() || this.type === tt.star) {
            isStatic = true;
        } else {
            keyName = "static";
        }
    }
    node.static = isStatic;

    if (!keyName && this.eatContextual("async")) {
        if ((this.isClassElementNameStart() || this.type === tt.star) && !this.canInsertSemicolon()) {
            isAsync = true;
        } else {
            keyName = "async";
        }
    }

    if (!keyName && this.eatContextual("func")) {
        if (this.isClassElementNameStart() || this.type === tt.star) {
            isFunc = true;
        } else {
            keyName = "func";
        }
    }

    if (!keyName && this.eat(tt.star)) {
        isGenerator = true;
    }

    if (!keyName && !isAsync && !isFunc && !isGenerator) {
        if (this.eatContextual("readonly")) {
            if (this.isClassElementNameStart()) {
                readonlyStart = this.start;
            } else {
                keyName = "readonly";
            }

        } else if (this.eatContextual("private")) {
            if (this.isClassElementNameStart()) {
                privateStart = this.start;
            } else {
                keyName = "private";
            }        
        }
    }

    if (!keyName && !isAsync && !isFunc && !isGenerator) {
        let lastValue = this.value;
        
        if (
            this.eatContextual("get")  ||
            this.eatContextual("set")  ||
            this.eatContextual("prop")
        ) {
            if (this.isClassElementNameStart()) {
                kind = lastValue;
            } else {
                keyName = lastValue;
            }
        }
    }

    // Parse element name
    if (keyName) {
        // 'async', 'get', 'set', or 'static' were not a keyword contextually.
        // The last token is any of those. Make it the element name.
        node.computed = false;
        node.key = this.startNodeAt(this.lastTokStart, this.lastTokStartLoc);
        node.key.name = keyName;
        this.finishNode(node.key, Syntax.Identifier);
    } else {
        this.parseClassElementName(node);
    }


    if (isFunc) {
        disallowReadonly();
        disallowPrivate();

        node.targetTag = atIdentifier;

        this.nxParseFunc(node, isAsync, isGenerator);

    } else if (kind === "prop") {
        node.readonly = (readonlyStart !== null);
        node.private  = (privateStart  !== null);

        node.observer = atIdentifier;

        this.nxParseProp(node);

    } else if (
        this.type === tt.parenL ||
        kind !== "method" ||
        isGenerator || isAsync ||
        this.tsMatchLeftRelational()
    ) {
        const isConstructor = !node.static && checkKeyName(node, "constructor");
        const allowsDirectSuper = isConstructor && constructorAllowsSuper;

        // Couldn't move this check into the 'parseClassMethod' method for backward compatibility.
        if (isConstructor && kind !== "method") {
            this.raise(node.key.start, "Constructor can't have get/set modifier");
        }

        disallowReadonly();
        disallowPrivate();
        
        node.kind = isConstructor ? "constructor" : kind;
        this.parseClassMethod(node, isGenerator, isAsync, allowsDirectSuper);
    
    } else {
        disallowPrivate();

        node.readonly = (readonlyStart !== null);

        this.parseClassField(node);
    }

    return node;
}


nxParseProp(node)
{
    node.typeAnnotation = (this.type == tt.colon) ? this.tsParseTypeAnnotation() : null;

    if (this.eat(tt.eq)) {
        let scope = this.currentThisScope();
        let inClassFieldInit = scope.inClassFieldInit;
        scope.inClassFieldInit = true;
        node.value = this.parseMaybeAssign();
        scope.inClassFieldInit = inClassFieldInit;
    } else {
        node.value = null;
    }

    this.semicolon();

    return this.finishNode(node, Syntax.NXPropDefinition)
}


nxParseFuncParameter()
{
    const node = this.startNode();
   
    let labelOrName = this.parseIdent(true);

    let label;
    let name;

    if (this.type == tt.question || this.type == tt.colon || this.type == tt.comma || this.type == tt.parenR) {
        label = null;
        name = labelOrName;
    } else {
        label = labelOrName;
        name = this.parseIdent(true);
    }
    
    node.label = label;
    node.name = name;

    if (this.type == tt.question) {
        this.raise(this.start, "Use of optional parameter with 'func'");
    }
        
    if (this.type == tt.colon) {
        node.typeAnnotation = (this.type == tt.colon) ? this.tsParseTypeAnnotation() : null;
    } else {
        node.typeAnnotation = null;
    }

    return this.finishNode(node, Syntax.NXFuncParameter);
}


nxParseFunc(node, isAsync, isGenerator)
{
    node.async = isAsync;
    node.generator = isGenerator;

    node.params = [ ];
    
    if (this.nxInInterface) {
        node.optional = this.eat(tt.question);
    }

    this.expect(tt.parenL);

    let needsComma = false;
    while (!this.eat(tt.parenR)) {
        if (needsComma) this.expect(tt.comma);
        node.params.push(this.nxParseFuncParameter());
        needsComma = true;
    }
    
    if (this.type == tt.colon) {
        node.returnType = this.tsParseReturnType();
    }

    if (this.type == tt.braceL) {
        let flags = 66; // 2(SCOPE_FUNCTION) + 64(SCOPE_SUPER)
        if (isAsync) flags += 4; // SCOPE_ASYNC
        if (isGenerator) flags += 8; // SCOPE_GENERATOR

        this.enterScope(flags);

        node.body = this.parseBlock();

        this.exitScope();
    }

    return this.finishNode(node, Syntax.NXFuncDefinition);
}


parseStatement(context, topLevel, exports)
{
    if (this.type == tt.atId) {
        // This block will be rewritten once acorn supports decorators.

        let atStart = this.start;
        let atIdentifier = this.nxParseAtIdentifier();
        
        let result = super.parseStatement(context, topLevel, exports);

        if (result.type == Syntax.ClassDeclaration) {
            result.nx_targetTag = atIdentifier;
        } else {
            this.unexpected(atStart);   
        }
        
        return result;

    } else if (this.isContextual("enum")) {
        let result = this.nxMaybeParseEnumDeclaration();
        if (result) return result;

    } else if (this.isContextual("interface")) {
        let result = this.nxMaybeParseInterfaceDeclaration();
        if (result) return result;

    } else if (this.isContextual("type")) {
        let result = this.nxMaybeParseTypeDefinition();
        if (result) return result;

    } else if (this.isContextual("global")) {
        let result = this.nxMaybeParseGlobalDefinition();
        if (result) return result;
    }
    
    return super.parseStatement(context, topLevel, exports);
}


}
