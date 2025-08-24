/*
    Traverser.js
    (c) 2024-2025 musictheory.net, LLC
    MIT license, http://www.opensource.org/licenses/mit-license.php

    Simple AST tree traverser. Uses TreeStructure defined in Tree.js.
*/

import { TreeStructure } from "./Tree.js";

const SkipNode = {};



export class Traverser {

static SkipNode = SkipNode;

constructor(ast)
{
    this._ast = ast;
}


_traverse(node, parent)
{
    if (this._enter(node, parent) == SkipNode) {
        return;
    }
    
    let keys = TreeStructure[node.type];
    if (!keys) {
        let e = new Error(`Unknown node type: ${node.type}`);
        e.node = node;
        e.parent = parent;
        throw e;
    }
    
    for (let key of keys) {
        let child = node[key];

        if (Array.isArray(child)) {
            for (let c of child) {
                if (c) this._traverse(c, node);
            }

        } else if (child) {
            this._traverse(child, node);
        }
    }
    
    this._leave?.(node, parent);
}


traverse(enter, leave)
{
    this._enter = enter;
    this._leave = leave;

    this._traverse(this._ast, null);
}


}

