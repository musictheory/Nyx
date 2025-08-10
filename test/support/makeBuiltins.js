#!env node

import nyx from "../../lib/api.js";
import fs   from "node:fs/promises";
import { fileURLToPath } from "node:url";

let assert_d_ts   = fileURLToPath(new URL("assert.d.ts", import.meta.url));
let builtins_json = fileURLToPath(new URL("builtins.json", import.meta.url));

let builtins = await nyx.generateBuiltins({
    "typescript-target": "es2018",
    "typescript-lib": "es2018",
    "defs": [ assert_d_ts ],
    "unused-interfaces": [
        /ArrayBuffer/, /Atomics/, /DataView/, /Date/, /Decorator/,
        /Float[0-9]+/, /Int[0-9]+/, /Uint[0-9]+/
    ],
    "unused-namespaces": [ /Intl/, /Reflect/ ]
});

let contents = JSON.stringify(builtins.sort(), null, "  ");
await fs.writeFile(builtins_json, contents);

