"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.typeTemplate = exports.schemaTemplate = void 0;
exports.schemaTemplate = `{{#each types}}
{{this}}
{{/each}}

type Query {
  {{#each queries}}
  {{this}}
  {{/each}}
}

schema {
  query: Query
}`;
exports.typeTemplate = `type {{typeName}} {
  id: ID!
  {{#each properties}}
  {{@key}}: {{#if this.plural}}[{{/if}}{{this.type}}{{#if this.plural}}{{#unless this.nullableElements}}!{{/unless}}]{{/if}}{{#unless this.nullable}}!{{/unless}}
  {{/each}}
}`;
//# sourceMappingURL=templates.js.map