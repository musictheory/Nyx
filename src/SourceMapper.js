/*
    SourceMapper.js
    (c) 2013-2025 musictheory.net, LLC
    MIT license, http://www.opensource.org/licenses/mit-license.php

    Wraps SourceMapGenerator to generate source maps.
*/

import { SourceMapGenerator } from "source-map";


export class SourceMapper {


constructor(file, sourceRoot)
{
    this._generator = new SourceMapGenerator({ 
        file:       file,
        sourceRoot: sourceRoot
    });

    this._outLine = 1;
}


add(name, lines)
{
    if (!lines) {
        console.log(name, lines);
        return;
    }

    if (name) {
        for (let i = 1, length = lines.length; i <= length; i++) {
            this._generator.addMapping({
                source: name,
                original:  { line: i,               column: 0 },
                generated: { line: this._outLine++, column: 0 }
            });
        }

    } else {
        this._outLine += lines.length;
    }
}


getSourceMap()
{
    return this._generator.toString();
}


}
