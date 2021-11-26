"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readYamlFile = void 0;
const fs_1 = require("fs");
const js_yaml_1 = require("js-yaml");
function readYamlFile(path) {
    return (0, js_yaml_1.load)((0, fs_1.readFileSync)(path, 'utf-8'));
}
exports.readYamlFile = readYamlFile;
//# sourceMappingURL=tools.js.map