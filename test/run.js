
import path from "node:path";
import test from "node:test";
import { spec } from "node:test/reporters";
import { Transform } from "node:stream";


const FixColorsTransform = new Transform({
    transform(chunk, encoding, callback) {
        let outputString = chunk.toString("utf8");
        
        outputString = outputString.replaceAll(/[\u001b]\[([0-9]+)m/g, (match, c) => {
            if      (c == "31") c = "91"; // Red    -> Bright Red
            else if (c == "32") c = "92"; // Green  -> Bright Green
            else if (c == "33") c = "93"; // Yellow -> Bright Yellow
            else if (c == "34") c = "37"; // Blue   -> Grey
            
            return `\u001b[${c}m`;
        });
        
        callback(null, outputString);
    },
});

const globPatterns = [
    "test/compiler/**.js",
    "test/components/**.js",
    "test/features/**.js",
    "test/issues/**.js",
    "test/NyxTestRunner.js" 
];

let includesCoverage = Array.from(process.argv).includes("coverage");
let includesFast     = Array.from(process.argv).includes("fast");

if (includesFast) {
    process.env["NYX_FAST_TEST"] = "1";
}

test.run({
    globPatterns,
    coverage: includesCoverage,
    coverageExcludeGlobs: [ "bin/**", "test/**" ],
    concurrency: true
})
    .on("test:fail", () => { process.exitCode = 1; })
    .compose(spec)
    .pipe(FixColorsTransform)
    .pipe(process.stdout);
