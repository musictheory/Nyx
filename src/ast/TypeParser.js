/*
    TypeParser.js
    
    This file is heavily based on acorn-typescript:
    https://github.com/sveltejs/acorn-typescript
    MIT License

    As much as possible, this file should replicate the ordering
    of methods in acorn-typescript.
    
    The intent of this class is to parse type annotations,
    type predicates, type parameters, and heritage clauses.
    
    Parsing higher-level declarations like `interface`, `enum`,
    and `type` should be the responsibility of the subclass.

    Subclasses must implement:
    - saveState()
    - restoreState()
    
    Subclasses may call:
    - tsParseTypeAnnotation() to parse a type annotation
    - tsParseReturnType() to parse 'returnType'
    - tsTryParseTypeParameters() to parse 'typeParameters'
    - tsParseHeritageClause() to parse 'extends' or 'implements'

    Subclasses may also call utility methods such as:
    - tsTryParse();
    - tsHasPrecedingLineBreak()
    - tsMatchLeftRelational()
    - tsMatchRightRelational()
*/

import {
    Parser as AcornParser,
    tokTypes as tt,
    lineBreak
} from "acorn";

import { Syntax } from "./Tree.js";


const skipWhiteSpace = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g;
const Maybe = Symbol();


function tokenIsIdentifier(token)
{
    return token == tt.name; //!FIXME
}


function keywordTypeFromName(value)
{
    switch (value) {
    case "any":
        return Syntax.TSAnyKeyword;
    case "boolean":
        return Syntax.TSBooleanKeyword;
    case "bigint":
        return Syntax.TSBigIntKeyword;
    case "never":
        return Syntax.TSNeverKeyword;
    case "number":
        return Syntax.TSNumberKeyword;
    case "object":
        return Syntax.TSObjectKeyword;
    case "string":
        return Syntax.TSStringKeyword;
    case "symbol":
        return Syntax.TSSymbolKeyword;
    case "undefined":
        return Syntax.TSUndefinedKeyword;
    case "unknown":
        return Syntax.TSUnknownKeyword;
    default:
        return undefined;
    }
}


export class TypeParser extends AcornParser {

#inType = false;
#allowsConditionalTypes = true;
#allowsNullableTypes = true;


readToken_lt_gt(code)
{
    if (this.#inType) {
        return this.finishOp(tt.relational, 1);
    }
    
    return super.readToken_lt_gt(code);
}


saveState()
{
    throw new Error("TypeParser is abstract and needs a saveState() implementation.");
}


restoreState(state)
{
    throw new Error("TypeParser is abstract and needs a restoreState() implementation.");
}


tsSetAllowsNullableTypesAnd(yn, callback)
{
    let oldAllowsNullableTypes = this.#allowsNullableTypes;
    this.#allowsNullableTypes = yn;
    
    try {
        return callback();
    } finally {
        this.#allowsNullableTypes = oldAllowsNullableTypes;
    }
}



// Replaces:
// tsInAllowConditionalTypesContext()
// tsInDisallowConditionalTypesContext()
tsSetAllowsConditionalTypesAnd(yn, callback)
{
    let oldAllowsConditionalTypes = this.#allowsConditionalTypes;
    this.#allowsConditionalTypes = yn;
    
    try {
        return callback();
    } finally {
        this.#allowsConditionalTypes = oldAllowsConditionalTypes;
    }
}

// Replaces tsInType()
tsSetInTypeAnd(yn, callback)
{
    const oldInType = this.#inType;
    this.#inType = true;

    try {
        return callback();
    } finally {
        this.#inType = oldInType;
    }
}


tsStartNodeAtNode(type)
{
    return super.startNodeAt(type.start, type.loc.start);
}


tsNextTokenStart()
{
    return this.tsNextTokenStartSince(this.pos);
}


tsNextTokenStartSince(pos)
{
    skipWhiteSpace.lastIndex = pos;
    return skipWhiteSpace.test(this.input) ? skipWhiteSpace.lastIndex : pos;
}

            
tsLookaheadCharCode()
{
    return this.input.charCodeAt(this.tsNextTokenStart());
}


tsResetStartLocation(node, start, startLoc)
{
    node.start = start;
    node.loc.start = startLoc;
}


tsHasPrecedingLineBreak()
{
    return lineBreak.test(
        this.input.slice(this.lastTokEnd, this.start)
    );
}


tsResetStartLocationFromNode(node, locationNode)
{
    this.tsResetStartLocation(node, locationNode.start, locationNode.loc.start);
}


tsParseEntityName()
{
    let entity = this.parseIdent(true);

    while (this.eat(tt.dot)) {
        const node = this.tsStartNodeAtNode(entity);

        node.left = entity;

        node.right = this.parseIdent(true);
        entity = this.finishNode(node, Syntax.TSQualifiedName);
    }

    return entity;
}


tsIsListTerminator(kind)
{
    switch (kind) {
    // case "EnumMembers":
    // case "TypeMembers":
    //     return this.type === tt.braceR;
    case "HeritageClauseElement":
        return this.type === tt.braceL;
    case "TupleElementTypes":
        return this.type === tt.bracketR;
    case "TypeParametersOrArguments":
        return this.tsMatchRightRelational();
    }
}


// Simplified version as acorn-typescript had
// code paths which were always/never executed
tsParseDelimitedList(kind, parseElement)
{
    const result = []
    let trailingCommaPos = -1;

    for (; ;) {
        if (this.tsIsListTerminator(kind)) {
            break;
        }
        trailingCommaPos = -1;

        const element = parseElement();

        // This check appears to be unnecessary, as our functions passed
        // into parseElement never return null/undefined
        /* node:coverage disable */
        if (element == null) {
            throw new Error(`Unexpected ${element} value.`);
        }
        /* node:coverage enable */

        result.push(element);

        if (this.eat(tt.comma)) {
            trailingCommaPos = this.lastTokStart;
            continue;
        }

        if (this.tsIsListTerminator(kind)) {
            break;
        }

        // This will fail with an error about a missing comma
        this.expect(tt.comma);
    }

    return result;
}


tsParseTypeParameterName()
{
    const typeName = this.parseIdent();
    return typeName.name;
}


tsEatThenParseType(token)
{
    return this.type === token ? this.tsNextThenParseType() : undefined;
}
            

tsNextThenParseType()
{
    return this.tsDoThenParseType(() => this.next());
}


tsDoThenParseType(callback)
{
    return this.tsSetInTypeAnd(true, () => {
        callback();
        return this.tsParseType();
    });
}


tsLookAhead(f)
{
    const state = this.saveState();
    const result = f();
    this.restoreState(state);
    return result;
}


tsTryParse(f)
{
    const state = this.saveState();
    const result = f();

    if (result !== undefined && result !== false) {
        return result;
    } else {
        this.restoreState(state);
        return undefined;
    }
}
      

tsSkipParameterStart()
{
    if (tokenIsIdentifier(this.type) || this.type === tt._this) {
        this.next();
        return true;
    }

    if (this.type === tt.braceL) {
        // Return true if we can parse an object pattern without errors
        try {
            this.parseObj(true);
            return true;
        } catch {
            return false;
        }
    }

    if (this.type === tt.bracketL) {
        this.next()
        
        try {
            this.parseBindingList(tt.bracketR, true, true);
            return true;
        } catch {
            return false
        }
    }
    
    return false;
}


tsIsUnambiguouslyStartOfFunctionType()
{
    this.next();

    if (this.type === tt.parenR || this.type === tt.ellipsis) {
          // ( )
          // ( ...
        return true;
    }

    if (this.tsSkipParameterStart()) {
        // We are either parsing a function type or an NXNullableType
        if (this.type === tt.question) {
            // ( xxx ?
            
            if (this.type === tt.parenR) {
                // ( xxx ? )
                this.next();
                if (this.type !== tt.arrow) {
                    return false;
                }

            } else if (this.type === tt.colon) {
                // ( xxx ? :
                return true;
            }
            
            return Maybe;
        }

        if (
            this.type === tt.colon ||
            this.type === tt.comma ||
            this.type === tt.eq
        ) {
            // ( xxx :
            // ( xxx ,
            // ( xxx =
            return true;
        }

        if (this.type === tt.parenR) {
            this.next();
            if (this.type === tt.arrow) {
                // ( xxx ) =>
                return true;
            }
        }
    }
    
    return false;
}


tsIsStartOfFunctionType()
{
    if (this.tsMatchLeftRelational()) {
        return true;
    }

    return (
        this.type === tt.parenL &&
        this.tsLookAhead(this.tsIsUnambiguouslyStartOfFunctionType.bind(this))
    );
}


tsParseBindingListForSignature()
{
    return super.parseBindingList(tt.parenR, true, true).map(pattern => {
        // This check appears to be unnecessary, as parseBindingList() 
        // always returns one of the listed node types
        /* node:coverage disable */
        if (
            pattern.type !== "Identifier" &&
            pattern.type !== "RestElement" &&
            pattern.type !== "ObjectPattern" &&
            pattern.type !== "ArrayPattern"
        ) {
            this.unexpected(pattern.start);
        }
        /* node:coverage enable */

        return pattern;
    });
}


tsParseTypePredicateAsserts()
{
    if (!this.isContextual("asserts")) {
        return false;
    }

    // Removed containsEsc logic as it is handled by isContextual()
    this.next();

    if (!tokenIsIdentifier(this.type) && this.type !== tt._this) {
        return false;
    }

    return true;
}
            
      
tsParseThisTypeNode()
{
    const node = this.startNode();
    this.next();
    return this.finishNode(node, Syntax.TSThisType);
}


tsParseTypeAnnotation(eatColon = true, t = this.startNode())
{
    this.tsSetInTypeAnd(true, () => {
        if (eatColon) this.expect(tt.colon);
        t.colon = eatColon;
        t.typeAnnotation = this.tsParseType();
    });

    return this.finishNode(t, Syntax.TSTypeAnnotation);
}


tsParseThisTypePredicate(lhs)
{
    this.next();

    const node = this.tsStartNodeAtNode(lhs);
    node.parameterName = lhs;
    node.typeAnnotation = this.tsParseTypeAnnotation(/* eatColon */ false);
    node.asserts = false;

    return this.finishNode(node, Syntax.TSTypePredicate);
}


tsParseThisTypeOrThisTypePredicate()
{
    const thisKeyword = this.tsParseThisTypeNode();

    if (this.isContextual("is") && !this.tsHasPrecedingLineBreak()) {
        return this.tsParseThisTypePredicate(thisKeyword);
    } else {
        return thisKeyword;
    }
}


tsParseTypePredicatePrefix()
{
    const id = this.parseIdent();

    if (this.isContextual("is") && !this.tsHasPrecedingLineBreak()) {
        this.next();
        return id;
    }
}


tsParseTypeOrTypePredicateAnnotation(returnToken)
{
    return this.tsSetInTypeAnd(true, () => {
        const t = this.startNode();
        this.expect(returnToken);
        const node = this.startNode();

        const asserts = !!this.tsTryParse(this.tsParseTypePredicateAsserts.bind(this));

        if (asserts && (this.type === tt._this)) {
            let thisTypePredicate = this.tsParseThisTypeOrThisTypePredicate();

            if (thisTypePredicate.type === Syntax.TSThisType) {
                node.parameterName = thisTypePredicate;
                node.asserts = true;
                node.typeAnnotation = null;
                thisTypePredicate = this.finishNode(node, Syntax.TSTypePredicate);
            } else {
                this.tsResetStartLocationFromNode(thisTypePredicate, node);
                thisTypePredicate.asserts = true;
            }

            t.typeAnnotation = thisTypePredicate;

            return this.finishNode(t, Syntax.TSTypeAnnotation);
        }

        const typePredicateVariable = tokenIsIdentifier(this.type) ?
            this.tsTryParse(this.tsParseTypePredicatePrefix.bind(this)) :
            null;

        if (!typePredicateVariable) {
            if (!asserts) {
                // : type
                return this.tsParseTypeAnnotation(/* eatColon */ false, t);
            }

            // : asserts foo
            node.parameterName = this.parseIdent();
            node.asserts = asserts;
            node.typeAnnotation = null;
            t.typeAnnotation = this.finishNode(node, Syntax.TSTypePredicate);
            
            return this.finishNode(t, Syntax.TSTypeAnnotation);
        }

        // : asserts foo is type
        const type = this.tsParseTypeAnnotation(/* eatColon */ false);
        node.parameterName = typePredicateVariable;
        node.typeAnnotation = type;
        node.asserts = asserts;
        t.typeAnnotation = this.finishNode(node, Syntax.TSTypePredicate);
        
        return this.finishNode(t, Syntax.TSTypeAnnotation);
    });
}


tsFillSignature(returnToken, signature)
{
    const returnTokenRequired = returnToken === tt.arrow;

    signature.typeParameters = this.tsTryParseTypeParameters();

    this.expect(tt.parenL);
    signature.params = this.tsParseBindingListForSignature();

    if (returnTokenRequired || this.type === returnToken) {
        signature.returnType = this.tsParseTypeOrTypePredicateAnnotation(returnToken);
    }
}


tsParseFunctionOrConstructorType(type)
{
    const node = this.startNode();

    if (type === Syntax.TSConstructorType) {
        node.abstract = false;
        this.next(); // eat 'new'
    }
   
    this.tsSetAllowsConditionalTypesAnd(true, () => {
        return this.tsFillSignature(tt.arrow, node)
    });
    
    return this.finishNode(node, type);
}


tsParseUnionOrIntersectionType(kind, parseConstituentType, operator)
{
    const node = this.startNode();
    const hasLeadingOperator = this.eat(operator);
    const types = [];

    do {
        types.push(parseConstituentType());
    } while (this.eat(operator));
    
    if (types.length === 1 && !hasLeadingOperator) {
        return types[0];
    }
    
    node.types = types;

    return this.finishNode(node, kind);
}


tsParseTypeOperator()
{
    const node = this.startNode();

    const operator = this.value;
    this.next(); // eat operator
    node.operator = operator;
    node.typeAnnotation = this.tsParseTypeOperatorOrHigher();

    return this.finishNode(node, Syntax.TSTypeOperator);
}


tsParseConstraintForInferType()
{
    if (this.eat(tt._extends)) {
        const constraint = this.tsSetAllowsConditionalTypesAnd(false, () => this.tsParseType());
        
        if (!this.#allowsConditionalTypes || this.type !== tt.question) {
            return constraint;
        }
    }
}


tsParseInferType()
{
    const node = this.startNode();
    this.expectContextual("infer");

    const typeParameter = this.startNode();
    typeParameter.name = this.tsParseTypeParameterName();
    typeParameter.constraint = this.tsTryParse(() => this.tsParseConstraintForInferType());

    node.typeParameter = this.finishNode(typeParameter, Syntax.TSTypeParameter);

    return this.finishNode(node, Syntax.TSInferType);
}


tsParseLiteralTypeNode()
{
    const node = this.startNode();
    const errorPos = this.start;
    let literal;

    let type = this.type;
    if (
        type == tt.num    ||
        type == tt.string ||
        type == tt._true  ||
        type == tt._false ||
        (type == tt.plusMin && this.value == "-")
    ) {
        literal = this.parseMaybeUnary();
    } else {
        this.unexpected();
    }

    // Verify that literal is either Syntax.Literal or a negative number
    let isNegativeNumber = (
        literal.type == Syntax.UnaryExpression &&
        literal.operator == "-" &&
        literal.argument.type == Syntax.Literal &&
        (typeof literal.argument.value == "number")
    );

    if (isNegativeNumber || (literal.type == Syntax.Literal)) {
        node.literal = literal;
    } else {
        this.unexpected(errorPos);
    }

    return this.finishNode(node, Syntax.TSLiteralType);
}


// tsParseImportType() removed


tsParseTypeQuery()
{
    const node = this.startNode();

    this.expect(tt._typeof);
    
    if (this.type === tt._import) {
        this.unexpected(); // No import support
    } else {
        node.name = this.tsParseEntityName();
    }

    if (!this.tsHasPrecedingLineBreak() && this.tsMatchLeftRelational()) {
        node.typeArguments = this.tsParseTypeArguments();
    }

    return this.finishNode(node, Syntax.TSTypeQuery);
}


// tsParseMappedTypeParameter() removed
// tsParseMappedType() removed

// NXObjectType is a simplified version of TSTypeLiteral
tsParseObjectType()
{
    const node = this.startNode();

    this.expect(tt.braceL);
    
    node.members = [ ];
    
    while (!this.eat(tt.braceR)) {
        const member = this.startNode();

        member.key = this.type == tt.string ?
            this.parseExprAtom() :
            this.parseIdent(true);
        
        member.optional = this.eat(tt.question);
        member.typeAnnotation = this.tsParseTypeAnnotation();
        
        node.members.push(this.finishNode(member, Syntax.NXObjectTypeMember));
        
        if (this.type != tt.braceR) {
            this.expect(tt.comma);
        }
    }

    return this.finishNode(node, Syntax.NXObjectType);
}


tsParseTupleElementType()
{
    const startLoc = this.startLoc;
    const startPos = this.start;
    const rest = this.eat(tt.ellipsis);

    let type = this.tsSetAllowsNullableTypesAnd(false, () => this.tsParseType());

    const optional = this.eat(tt.question);
    const labeled = this.eat(tt.colon);

    if (labeled) {
        const labeledNode = this.tsStartNodeAtNode(type);
        labeledNode.optional = optional;

        if (
            type.type === Syntax.TSTypeReference &&
            !type.typeArguments &&
            type.typeName.type === Syntax.Identifier
        ) {
            labeledNode.label = type.typeName;
        } else {
            this.raise(type.start, "Tuple members must be labeled with a simple identifier.");
        }

        labeledNode.elementType = this.tsParseType();

        type = this.finishNode(labeledNode, Syntax.TSNamedTupleMember);

    } else if (optional) {
        const optionalTypeNode = this.tsStartNodeAtNode(type);

        optionalTypeNode.typeAnnotation = type;
        type = this.finishNode(optionalTypeNode, Syntax.TSOptionalType);
    }

    if (rest) {
        const restNode = this.startNodeAt(startPos, startLoc);
        restNode.typeAnnotation = type;
        type = this.finishNode(restNode, Syntax.TSRestType);
    }

    return type;
}


tsParseTupleType()
{
    const node = this.startNode();

    this.expect(tt.bracketL);

    node.elementTypes = this.tsParseDelimitedList(
        "TupleElementTypes",
        this.tsParseTupleElementType.bind(this)
    );

    this.expect(tt.bracketR);

    return this.finishNode(node, Syntax.TSTupleType);
}


// tsParseTemplateLiteralType() removed


tsParseTypeReference()
{
    const node = this.startNode();
    
    node.typeName = this.tsParseEntityName();
    
    if (!this.tsHasPrecedingLineBreak() && this.tsMatchLeftRelational()) {
        node.typeArguments = this.tsParseTypeArguments()
    }
    
    return this.finishNode(node, Syntax.TSTypeReference);
}


tsMatchLeftRelational()
{
    return this.type === tt.relational && this.value === "<";
}


tsMatchRightRelational()
{
    return this.type === tt.relational && this.value === ">";
}


tsParseParenthesizedType()
{
    const node = this.startNode();
    this.expect(tt.parenL);
    node.typeAnnotation = this.tsSetAllowsNullableTypesAnd(true, () => this.tsParseType());
    this.expect(tt.parenR);
    return this.finishNode(node, Syntax.NXParenthesizedType);
}


tsParseNonArrayType()
{
    switch (this.type) {
    case tt.string:
    case tt.num:
    case tt._true:
    case tt._false:
    case tt.plusMin:
        return this.tsParseLiteralTypeNode();

    case tt._this:
        return this.tsParseThisTypeOrThisTypePredicate();

    case tt._typeof:
        return this.tsParseTypeQuery();
    
    case tt._import:
        this.unexpected(); // No import support

    case tt.braceL:
        // No mapped type support, only handle type literals
        return this.tsParseObjectType();

    case tt.bracketL:
        return this.tsParseTupleType();
        
    case tt.parenL:
        return this.tsParseParenthesizedType();

    case tt.backQuote:
    case tt.dollarBraceL:
        return this.unexpected(); // No template literal support
    
    default:
        {
            const type = this.type;
            const isIdentifier = tokenIsIdentifier(type);

            if (isIdentifier || type === tt._void || type === tt._null) {
                let nodeType;

                if (type === tt._void) {
                    nodeType = Syntax.TSVoidKeyword;
                } else if (type === tt._null) {
                    nodeType = Syntax.TSNullKeyword;
                } else if (isIdentifier) {
                    nodeType = keywordTypeFromName(this.value);
                }

                if (nodeType !== undefined && this.tsLookaheadCharCode() !== 46) { // '.'
                    const node = this.startNode();
                    this.next();
                    return this.finishNode(node, nodeType);
                }

                return this.tsParseTypeReference();
            }
        }
    }

    this.unexpected();
}


tsParseArrayTypeOrHigher()
{
    let type = this.tsParseNonArrayType();

    // Only eat the '?' if we aren't parsing extendsType of a conditional type
    const eatQuestion = () => {
        return this.#allowsNullableTypes && this.eat(tt.question);
    }

    const makeNullable = (inType) => {
        const node = this.tsStartNodeAtNode(inType);
        node.typeAnnotation = inType;
        return this.finishNode(node, Syntax.NXNullableType);
    };

    while (!this.tsHasPrecedingLineBreak()) {
        if (this.eat(tt.bracketL)) {
            if (this.type === tt.bracketR) {
                const node = this.tsStartNodeAtNode(type);
                node.elementType = type;
                this.expect(tt.bracketR);
                type = this.finishNode(node, Syntax.TSArrayType);
                
                // Allow Foo[]?
                if (eatQuestion()) {
                    type = makeNullable(type);
                }

            } else {
                const node = this.tsStartNodeAtNode(type);
                node.objectType = type;
                node.indexType = this.tsParseType();
                this.expect(tt.bracketR);
                type = this.finishNode(node, Syntax.TSIndexedAccessType);
            }

        } else if (eatQuestion()) {
            // See parsePostfixTypeOrHigher() in TypeScript's parser.ts
            type = makeNullable(type);

        } else {
            break;
        }
    }
    
    return type;
}


tsParseTypeOperatorOrHigher()
{
    if (this.type == tt.name && !this.containsEsc) {
        const value = this.value;
        if (value === "readonly" || value === "keyof" || value === "unique") {
            return this.tsParseTypeOperator();
        }
    }
    
    if (this.isContextual("infer")) {
        return this.tsParseInferType();    
    }
    
    return this.tsSetAllowsConditionalTypesAnd(true, () => this.tsParseArrayTypeOrHigher());
}
      

tsParseIntersectionTypeOrHigher()
{
    return this.tsParseUnionOrIntersectionType(
        Syntax.TSIntersectionType,
        this.tsParseTypeOperatorOrHigher.bind(this),
        tt.bitwiseAND
    );
}


tsParseUnionTypeOrHigher()
{
    return this.tsParseUnionOrIntersectionType(
        Syntax.TSUnionType,
        this.tsParseIntersectionTypeOrHigher.bind(this),
        tt.bitwiseOR
    );
}


tsParseNonConditionalType()
{
    let isStartOfFunctionType = this.tsIsStartOfFunctionType();
    
    if (isStartOfFunctionType === true) {
        return this.tsParseFunctionOrConstructorType(Syntax.TSFunctionType);
    
    } else if (isStartOfFunctionType === Maybe) {
        let state = this.saveState();
        
        try {
            return this.tsParseFunctionOrConstructorType(Syntax.TSFunctionType);
        } catch (e) {
            this.restoreState(state);
        }
    }

    if (this.type === tt._new) {
        return this.tsParseFunctionOrConstructorType(Syntax.TSConstructorType);
    }
    
    return this.tsParseUnionTypeOrHigher();
}


tsParseType()
{
    const type = this.tsParseNonConditionalType();

    if (
        !this.#allowsConditionalTypes ||
        this.tsHasPrecedingLineBreak() ||
        !this.eat(tt._extends)
    ) {
        return type;
    }

    const node = this.tsStartNodeAtNode(type);

    node.checkType = type;
    node.extendsType = this.tsSetAllowsConditionalTypesAnd(false, () => {
        this.tsSetAllowsNullableTypesAnd(false, () => {
            return this.tsParseNonConditionalType();
        });
    });

    this.expect(tt.question);
    node.trueType = this.tsSetAllowsConditionalTypesAnd(true, () => this.tsParseType());

    this.expect(tt.colon);
    node.falseType = this.tsSetAllowsConditionalTypesAnd(true, () => this.tsParseType());

    return this.finishNode(node, Syntax.TSConditionalType);
}


tsParseConstModifier(node)
{
    if (this.value === "const" && !this.containsEsc) {
        this.next();
        node.const = true;
    }
}


tsParseInOutModifiers(node)
{
    if (this.value === "in" && !this.containsEsc) {
        this.next();
        node.in = true;
    }

    if (this.value === "out" && !this.containsEsc) {
        this.next();
        node.out = true;
    }
}


tsParseTypeParameter(parseModifiers)
{
    const node = this.startNode();

    if (parseModifiers) parseModifiers(node);

    node.name = this.tsParseTypeParameterName();
    node.constraint = this.tsEatThenParseType(tt._extends);
    node.default = this.tsEatThenParseType(tt.eq);

    return this.finishNode(node, Syntax.TSTypeParameter);
}


tsParseTypeParameters(parseModifiers)
{
    const node = this.startNode();

    this.tsMatchLeftRelational() ? this.next() : this.unexpected();

    node.params = this.tsParseDelimitedList(
        "TypeParametersOrArguments",
        this.tsParseTypeParameter.bind(this, parseModifiers),
    );

    this.tsMatchRightRelational() ? this.next() : this.unexpected();

    if (node.params.length === 0) {
        this.raise(this.start, "Type parameter list cannot be empty.");
    }

    return this.finishNode(node, Syntax.TSTypeParameterDeclaration);
}


tsTryParseTypeParameters(parseModifiers)
{
    if (this.tsMatchLeftRelational()) {
        if (parseModifiers === "const") {
            parseModifiers = this.tsParseConstModifier.bind(this);
        } else if (parseModifiers === "inout") {
            parseModifiers = this.tsParseInOutModifiers.bind(this);
        }

        return this.tsParseTypeParameters(parseModifiers);
    }
}


tsParseTypeArguments()
{
    const node = this.startNode();

    node.params = this.tsSetInTypeAnd(true, () => {
        this.expect(tt.relational);

        return this.tsParseDelimitedList(
            "TypeParametersOrArguments",
            this.tsParseType.bind(this)
        );
    });

    if (!node.params.length) {
        this.raise(this.start, "Type argument list cannot be empty.");
    }

    this.exprAllowed = false
    this.expect(tt.relational);

    return this.finishNode(node, Syntax.TSTypeParameterInstantiation);
}


tsParseReturnType()
{
    return this.tsParseTypeOrTypePredicateAnnotation(tt.colon);
}


tsParseHeritageClause(token)
{
    let originalStart = this.start;

    let nodeType = token === "implements" ?
        Syntax.TSClassImplements :
        Syntax.TSInterfaceHeritage;
    
    let delimitedList = this.tsParseDelimitedList("HeritageClauseElement", () => {
        const node = this.startNode();
        node.expression = this.tsParseEntityName();

        if (this.tsMatchLeftRelational()) {
            node.typeArguments = this.tsParseTypeArguments();
        }

        return this.finishNode(node, nodeType);
    });

    if (!delimitedList.length) {
        this.raise(originalStart, `'${token}' list cannot be empty.`);
    }

    return delimitedList;
}


}

