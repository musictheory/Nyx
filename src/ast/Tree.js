/*
    Tree.js
    (c) 2024-2025 musictheory.net, LLC
    MIT license, http://www.opensource.org/licenses/mit-license.php

    Defines tree structure for Ecmascript, TypeScript annotations, and Nyx.
*/

/*
    ESTreeStructure follows the ESTree spec
    https://github.com/estree/estree
*/
const ESTreeStructure = {
    AssignmentExpression:     [ "left", "right" ],
    AssignmentPattern:        [ "left", "right" ],
    ArrayExpression:          [ "elements" ],
    ArrayPattern:             [ "elements" ],
    ArrowFunctionExpression:  [ "params", "body" ],
    AwaitExpression:          [ "argument" ],
    BlockStatement:           [ "body" ],
    BinaryExpression:         [ "left", "right" ],
    BreakStatement:           [ "label" ],
    CallExpression:           [ "callee", "arguments" ],
    CatchClause:              [ "param", "body" ],
    ChainExpression:          [ "expression" ],
    ClassBody:                [ "body" ],
    ClassDeclaration:         [ "id", "superClass", "body" ],
    ClassExpression:          [ "id", "superClass", "body" ],
    ConditionalExpression:    [ "test", "consequent", "alternate" ],
    ContinueStatement:        [ "label" ],
    DebuggerStatement:        [ ],
    DoWhileStatement:         [ "body", "test" ],
    EmptyStatement:           [ ],
    ExportAllDeclaration:     [ "source" ],
    ExportDefaultDeclaration: [ "declaration" ],
    ExportNamedDeclaration:   [ "declaration", "specifiers", "source" ],
    ExportSpecifier:          [ "exported", "local" ],
    ExpressionStatement:      [ "expression" ],
    ForStatement:             [ "init", "test", "update", "body" ],
    ForInStatement:           [ "left", "right", "body" ],
    ForOfStatement:           [ "left", "right", "body" ],
    FunctionDeclaration:      [ "id", "params", "body" ],
    FunctionExpression:       [ "id", "params", "body" ],
    Identifier:               [ ],
    IfStatement:              [ "test", "consequent", "alternate" ],
    ImportExpression:         [ "source" ],
    ImportDeclaration:        [ "specifiers", "source" ],
    ImportDefaultSpecifier:   [ "local" ],
    ImportNamespaceSpecifier: [ "local" ],
    ImportSpecifier:          [ "imported", "local" ],
    Literal:                  [ ],
    LabeledStatement:         [ "label", "body" ],
    LogicalExpression:        [ "left", "right" ],
    MemberExpression:         [ "object", "property" ],
    MetaProperty:             [ "meta", "property" ],
    MethodDefinition:         [ "key", "value" ],
    ModuleSpecifier:          [ ],
    NewExpression:            [ "callee", "arguments" ],
    ObjectExpression:         [ "properties" ],
    ObjectPattern:            [ "properties" ],
    PrivateIdentifier:        [ ],
    Program:                  [ "body"],
    Property:                 [ "key", "value" ],
    PropertyDefinition:       [ "key", "value" ],
    RestElement:              [ "argument" ],
    ReturnStatement:          [ "argument" ],
    SequenceExpression:       [ "expressions" ],
    SpreadElement:            [ "argument" ],
    StaticBlock:              [ "body" ],
    Super:                    [ ],
    SwitchStatement:          [ "discriminant", "cases" ],
    SwitchCase:               [ "test", "consequent" ],
    TaggedTemplateExpression: [ "tag", "quasi" ],
    TemplateElement:          [ ],
    TemplateLiteral:          [ "quasis", "expressions" ],
    ThisExpression:           [ ],
    ThrowStatement:           [ "argument" ],
    TryStatement:             [ "block", "handler", "finalizer" ],
    UnaryExpression:          [ "argument" ],
    UpdateExpression:         [ "argument" ],
    VariableDeclaration:      [ "declarations" ],
    VariableDeclarator:       [ "id", "init" ],
    WhileStatement:           [ "test", "body" ],
    WithStatement:            [ "object", "body" ],
    YieldExpression:          [ "argument" ]
};


const NyxTreeStructure = {
    NXAsExpression:         [ "expression", "typeAnnotation" ],
    NXAtIdentifier:         [ ],
    NXEnumDeclaration:      [ "members" ],
    NXEnumMember:           [ "id", "init" ],
    NXFuncDefinition:       [ "key", "params", "returnType", "body" ],
    NXFuncParameter:        [ "label", "name", "typeAnnotation" ],
    NXGlobalDeclaration:    [ "declaration" ],
    NXInterfaceBody:        [ "body" ],
    NXInterfaceDeclaration: [ "id", "body" ],
    NXNamedArgument:        [ "name", "argument" ],
    NXNonNullExpression:    [ "expression" ],
    NXPropDefinition:       [ "key", "value", "typeAnnotation" ],
    NXPunctuation:          [ ],
    NXTypeDeclaration:      [ "id", "params", "typeAnnotation" ],
};


/*
    TypeAnnotationTreeStructure follows the TSESTree spec:
    https://typescript-eslint.io/packages/typescript-estree/ast-spec
    
    Unlike acorn-typescript, we use "NXParenthesizedType" instead of
    "TSParenthesizedType" as it is not part of the TSESTree spec.
*/
const TypeAnnotationTreeStructure = {
    NXNullableType:      [ "typeAnnotation" ],
    NXParenthesizedType: [ "typeAnnotation" ],
    NXObjectTypeMember:  [ "key", "typeAnnotation" ],
    NXObjectType:        [ "members" ],

    TSAnyKeyword:        [ ],
    TSArrayType:         [ "elementType" ],
    TSBigIntKeyword:     [ ],
    TSBooleanKeyword:    [ ],
    TSClassImplements:   [ "expression", "typeArguments" ],
    TSConditionalType:   [ "checkType", "extendsType", "trueType", "falseType" ],
    TSConstructorType:   [ "params", "returnType" ],
    TSDeclareFunction:   [ "id", "params" ],
    TSEmptyBodyFunctionExpression: [ "id", "params" ],
    TSFunctionType:      [ "params", "returnType" ],
    TSIndexedAccessType: [ "objectType", "indexType" ],
    TSInferType:         [ "typeParameter" ],
    TSInterfaceHeritage: [ "expression", "typeArguments" ],
    TSIntersectionType:  [ "types" ],
    TSLiteralType:       [ "literal" ],
    TSNamedTupleMember:  [ "elementType", "label" ],
    TSNeverKeyword:      [ ],
    TSNullKeyword:       [ ],
    TSNumberKeyword:     [ ],
    TSOptionalType:      [ "typeAnnotation" ],
    TSObjectKeyword:     [ ],
    TSQualifiedName:     [ "left", "right" ],
    TSRestType:          [ "typeAnnotation" ],
    TSStringKeyword:     [ ],
    TSSymbolKeyword:     [ ],
    TSThisType:          [ ],
    TSTupleType:         [ "elementTypes" ],
    TSTypeAnnotation:    [ "typeAnnotation" ],
    TSTypeOperator:      [ "typeAnnotation" ],
    TSTypeParameter:     [ "name", "constraint", "default" ],
    TSTypeParameterDeclaration:   [ "params" ],
    TSTypeParameterInstantiation: [ "params" ],
    TSTypePredicate:     [ "typeAnnotation" ],
    TSTypeQuery:         [ "name", "typeArguments" ],
    TSTypeReference:     [ "name", "typeArguments" ],
    TSUndefinedKeyword:  [ ],
    TSUnionType:         [ "types" ],
    TSUnknownKeyword:    [ ],
    TSVoidKeyword:       [ ]
};


export const TreeStructure = Object.assign({ },
    ESTreeStructure,
    NyxTreeStructure,
    TypeAnnotationTreeStructure
);


// Extend ESTree nodes to include "returnType" or "typeAnnotation"
{
    function addAfter(array, existing, value) {
        array.splice(array.indexOf(existing), 0, value);
    }

    addAfter( TreeStructure.NewExpression, "callee", "typeParameters" );

    addAfter( TreeStructure.ClassDeclaration, "id", "typeParameters" );
    addAfter( TreeStructure.ClassDeclaration, "superClass", "superTypeParameters" );
    addAfter( TreeStructure.ClassDeclaration, "superTypeParameters", "implements" );

    addAfter( TreeStructure.ClassExpression, "id", "typeParameters" );
    addAfter( TreeStructure.ClassExpression, "superClass", "superTypeParameters" );
    addAfter( TreeStructure.ClassExpression, "superTypeParameters", "implements" );

    addAfter( TreeStructure.FunctionDeclaration, "id", "typeParameters" );
    addAfter( TreeStructure.FunctionDeclaration, "params", "returnType" );

    addAfter( TreeStructure.FunctionExpression,  "id", "typeParameters" );
    addAfter( TreeStructure.FunctionExpression,  "params", "returnType" );

    TreeStructure.Identifier.push("typeAnnotation");
    TreeStructure.RestElement.push("typeAnnotation");
    TreeStructure.ObjectPattern.push("typeAnnotation");
    TreeStructure.ArrayPattern.push("typeAnnotation");

    TreeStructure.PropertyDefinition.push("typeAnnotation");
}


export const Syntax = Object.fromEntries(Object.keys(TreeStructure).map(x => [ x, x ]));
