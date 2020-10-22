export const schemaTemplate =
  `{{#each types}}
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

export const typeTemplate =
  `type {{typeName}} {
  id: ID!
  {{#each properties}}
  {{@key}}: {{#if this.plural}}[{{/if}}{{this.type}}{{#if this.plural}}{{#unless this.nullableElements}}!{{/unless}}]{{/if}}{{#unless this.nullable}}!{{/unless}}
  {{/each}}
}`;