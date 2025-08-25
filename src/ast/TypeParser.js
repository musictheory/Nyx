/*
    TypeParser.js
    
    This file is heavily based on acorn-typescript:
    https://github.com/TyrealHu/acorn-typescript
    MIT License

    Subclass of Acorn's Parser to parse type annotations
*/

import {
    Parser as AcornParser,
    tokTypes as tt,
    lineBreak
} from "acorn";

import { Syntax } from "./Tree.js";


function tokenIsIdentifier(token)
{
    return token == tt.name; //!FIXME
}


function nonNull(x)
{
    if (x == null) {
        throw new Error(`Unexpected ${x} value.`);
    }
    return x;
}


const sKeywordNames = new Set([
    "any", "boolean", "bigint", "never", "number", "null",
    "object", "string", "symbol", "undefined", "void"
]);


export class TypeParser extends AcornParser {

readToken_lt_gt(code)
{
    if (this._tsInType) {
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
        const node = this.startNodeAt(entity.start);
        node.left = entity;
        node.right = this.parseIdent(true);
        entity = this.finishNode(node, Syntax.TSQualifiedName);
    }

    return entity;
}


tsIsListTerminator(kind)
{
    switch (kind) {
    case "EnumMembers":
    case "TypeMembers":
        return this.type === tt.braceR;
    case "HeritageClauseElement":
        return this.type === tt.braceL;
    case "TupleElementTypes":
        return this.type === tt.bracketR;
    case "TypeParametersOrArguments":
        return this.tsMatchRightRelational();
    }
}


tsParseDelimitedListWorker(kind, parseElement, expectSuccess)
{
    const result = []
    let trailingCommaPos = -1;

    for (; ;) {
        if (this.tsIsListTerminator(kind)) {
            break;
        }
        trailingCommaPos = -1;

        const element = parseElement();
        if (element == null) {
            return undefined;
        }
        result.push(element);

        if (this.eat(tt.comma)) {
            trailingCommaPos = this.lastTokStart;
            continue;
        }

        if (this.tsIsListTerminator(kind)) {
            break;
        }

        if (expectSuccess) {
            // This will fail with an error about a missing comma
            this.expect(tt.comma);
        }

        return undefined;
    }

    return result;
}

      
tsParseDelimitedList(kind, parseElement)
{
    return nonNull(this.tsParseDelimitedListWorker(kind, parseElement, /* expectSuccess */ true));
}

      
tsLookAhead(f)
{
    // saveState() and restoreState() are implemented in Parser.js
    const state = this.saveState();
    const result = f();
    this.restoreState(state);
    return result;
}


tsTryParse(f)
{
    // saveState() and restoreState() are implemented in Parser.js
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
        if (
            this.type === tt.colon ||
            this.type === tt.comma ||
            this.type === tt.question ||
            this.type === tt.eq
        ) {
            // ( xxx :
            // ( xxx ,
            // ( xxx ?
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
    this.tsInType(() => {
        if (eatColon) this.expect(tt.colon);
        t.colon = eatColon;
        t.typeAnnotation = this.tsParseType();
    });

    return this.finishNode(t, Syntax.TSTypeAnnotation);
}


tsParseThisTypePredicate(lhs)
{
    this.next();

    const node = this.startNodeAt(lhs.start);
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
    return this.tsInType(() => {
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

    if (this.tsMatchLeftRelational()) {
        // Disallow type parameters
        this.unexpected();
    }

    this.expect(tt.parenL);
    signature.params = this.tsParseBindingListForSignature();

    if (returnTokenRequired || this.type === returnToken) {
        this.expect(returnToken);
        signature.returnType = this.tsParseTypeAnnotation(/* eatColon */ false);
    }
}


tsParseFunctionOrConstructorType(type)
{
    const node = this.startNode();

    if (type === Syntax.TSConstructorType) {
        node.abstract = false;
        this.next(); // eat 'new'
    }
   
    this.tsFillSignature(tt.arrow, node);
    
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


// tsParseConstraintForInferType() removed
// tsParseInferType() removed


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

    let type = this.tsParseType();
    const labeled = this.eat(tt.colon);

    if (labeled) {
        // No labelled tuple element support
        this.unexpected();
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
    const name = this.tsParseEntityName();
    
    node.name = name;
    
    if (!sKeywordNames.has(name.name) && !this.tsHasPrecedingLineBreak() && this.tsMatchLeftRelational()) {
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
    node.typeAnnotation = this.tsParseType();
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
            if (
                this.type !== tt._void &&
                this.type !== tt._null &&
                !tokenIsIdentifier(this.type)
            ) {
                this.unexpected();
            }

            // Rather than TSVoidKeyword / TSStringKeyword / etc, we pass everything
            // to tsParseTypeReference() and use Identifier nodes
            return this.tsParseTypeReference();
        }
    }
}


tsParseArrayTypeOrHigher()
{
    let type = this.tsParseNonArrayType();

    const makeNullable = (inType) => {
        const node = this.startNodeAt(inType.start);
        node.typeAnnotation = inType;
        return this.finishNode(node, Syntax.NXNullableType);
    };

    while (!this.tsHasPrecedingLineBreak()) {
        if (this.eat(tt.bracketL)) {
            if (this.type === tt.bracketR) {
                const node = this.startNodeAt(type.start);
                node.elementType = type;
                this.expect(tt.bracketR);
                type = this.finishNode(node, Syntax.TSArrayType);
                
                // Allow Foo[]?
                if (this.eat(tt.question)) {
                    type = makeNullable(type);
                }

            } else {
                const node = this.startNodeAt(type.start);
                node.objectType = type;
                node.indexType = this.tsParseType();
                this.expect(tt.bracketR);
                type = this.finishNode(node, Syntax.TSIndexedAccessType);
            }

        } else if (this.eat(tt.question)) {
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
    if (this.type == tt.name && this.value == "readonly" && !this.containsEsc) {
        return this.tsParseTypeOperator();
    }
    
    return this.tsParseArrayTypeOrHigher();
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
    if (this.tsIsStartOfFunctionType()) {
        return this.tsParseFunctionOrConstructorType(Syntax.TSFunctionType);
    } 
    
    if (this.type === tt._new) {
        return this.tsParseFunctionOrConstructorType(Syntax.TSConstructorType);
    }
    
    return this.tsParseUnionTypeOrHigher();
}


tsParseType()
{
    return this.tsParseNonConditionalType();
}


tsInType(callback)
{
    const oldInType = this._tsInType;
    this._tsInType = true;

    try {
        return callback();
    } finally {
        this._tsInType = oldInType;
    }
}


tsParseTypeArguments()
{
    this.expect(tt.relational);
    let results = this.tsParseDelimitedList("TypeParametersOrArguments", this.tsParseType.bind(this));
    this.exprAllowed = false
    this.expect(tt.relational)

    return results;
}


}

