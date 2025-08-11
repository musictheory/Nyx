
import { Compiler as CompilerImpl } from "../src/Compiler.js";
import { tuneTypecheckerPerformance } from "../src/typechecker/Typechecker.js";
import { generateBuiltins } from "../src/typechecker/BuiltinGenerator.js"
import { Utils } from "../src/Utils.js";
import { SymbolUtils } from "../src/SymbolUtils.js"


export class Compiler {

    #impl;
    
    constructor()
    {
        this.#impl = new CompilerImpl();
    }


    uses(compiler)
    {
        if (!(compiler instanceof Compiler)) {
            throw new TypeError("The argument must be an instance of Nyx.Compiler"); 
        }

        this.#impl.uses(compiler.#impl);
    }


    async compile(options)
    {
        return this.#impl.compile(options);
    }


    async collectTypecheckerWarnings()
    {
        return this.#impl.collectTypecheckerWarnings();
    }

}


export class File {

    #impl;

    constructor(impl) {
        this.#impl = impl;
    }

}


export default {
    Compiler,

    compile: async function(options) {
        return (new Compiler()).compile(options);
    },

    tuneTypecheckerPerformance(includeInCompileResults, workerCount) {
        return tuneTypecheckerPerformance(includeInCompileResults, workerCount);
    },
    
    generateBuiltins(options) {
        return generateBuiltins(options);
    },

    symbolicate: function(symbol, squeezed) {
        return SymbolUtils.symbolicate(symbol, squeezed);
    }
};
