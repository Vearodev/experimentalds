import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import YAML from 'yaml';
import { parse } from '@babel/parser';

const source = path.resolve(process.argv[2] || '../apiserver');
const target = path.resolve('design/reference/apiserver-inventory.json');
const specFile = path.join(source, 'artifacts/openapi.yaml');
const sourceText = fs.readFileSync(specFile, 'utf8');
const spec = YAML.parse(sourceText);
const relative = (file) => path.relative(source, file).replaceAll('\\', '/');
function files(directory, pattern) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const file = path.join(directory, item.name);
    return item.isDirectory() ? files(file, pattern) : pattern.test(item.name) ? [file] : [];
  });
}
function resolve(schema, visited = new Set()) {
  if (!schema?.$ref || visited.has(schema.$ref)) return schema || {};
  visited.add(schema.$ref);
  return resolve(
    schema.$ref
      .slice(2)
      .split('/')
      .reduce((value, key) => value?.[key], spec),
    visited,
  );
}
function fields(schema) {
  schema = resolve(schema);
  const properties = Object.assign(
    {},
    ...(schema.allOf || []).map((s) => resolve(s).properties || {}),
    schema.properties,
  );
  return Object.entries(properties).map(([name, raw]) => {
    const field = resolve(raw);
    return {
      name,
      type: field.type,
      required: schema.required?.includes(name) || false,
      description: field.description || raw.description,
      enum: field.enum,
      minimum: field.minimum,
      maximum: field.maximum,
      default: field.default,
      reference: raw.$ref,
      items: field.items?.$ref || field.items?.type,
    };
  });
}
const operations = Object.entries(spec.paths || {}).flatMap(([url, definition]) =>
  Object.entries(definition)
    .filter(([method]) => ['get', 'post', 'patch', 'delete', 'put'].includes(method))
    .map(([method, operation]) => {
      const body = resolve(operation.requestBody);
      const request = Object.values(body.content || {})[0]?.schema || {};
      const response = resolve(operation.responses?.['200']);
      const responseSchema = resolve(Object.values(response.content || {})[0]?.schema);
      return {
        path: url,
        method: method.toUpperCase(),
        id: operation.operationId,
        summary: operation.summary,
        description: operation.description,
        tags: operation.tags,
        parameters: fields(request),
        responseType: responseSchema.type,
        responseFields: fields(responseSchema),
        listFields: fields(resolve(responseSchema.properties?.data)?.items || responseSchema.items),
      };
    }),
);
function property(node, name) {
  return node.properties.find(
    (p) => p.type === 'ObjectProperty' && (p.key.name || p.key.value) === name,
  )?.value;
}
function literal(node) {
  if (!node) return undefined;
  if (['StringLiteral', 'BooleanLiteral'].includes(node.type)) return node.value;
  if (node.type === 'ArrayExpression')
    return node.elements.map(literal).filter((v) => v !== undefined);
  return undefined;
}
const routes = [];
for (const file of [
  ...files(path.join(source, 'decort-portal/legacy/src/router'), /\.js$/),
  ...files(path.join(source, 'decort-portal/app/src/modules'), /^router\.ts$/),
]) {
  const contents = fs.readFileSync(file, 'utf8');
  const sourceFile = parse(contents, { sourceType: 'module', plugins: ['typescript'] });
  function visit(node, parentPath = '') {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ObjectExpression' && literal(property(node, 'path')) !== undefined) {
      const routePath = literal(property(node, 'path'));
      const fullPath = routePath.startsWith('/')
        ? routePath
        : `${parentPath}/${routePath}`.replaceAll(/\/+/g, '/');
      const meta = property(node, 'meta');
      const componentNode = property(node, 'component');
      const component = componentNode
        ? contents.slice(componentNode.start, componentNode.end)
        : undefined;
      routes.push({
        source: relative(file),
        path: fullPath,
        name: literal(property(node, 'name')),
        hidden: literal(property(node, 'hidden')) || false,
        title: meta?.type === 'ObjectExpression' ? literal(property(meta, 'title')) : undefined,
        roles: meta?.type === 'ObjectExpression' ? literal(property(meta, 'roles')) : undefined,
        modules: meta?.type === 'ObjectExpression' ? literal(property(meta, 'modules')) : undefined,
        component: component?.match(/import\(["']([^"']+)/)?.[1],
      });
      const children = property(node, 'children');
      if (children) visit(children, fullPath);
      return;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach((child) => visit(child, parentPath));
      else if (value && typeof value === 'object') visit(value, parentPath);
    }
  }
  visit(sourceFile);
}
const inventory = {
  source: 'Базис.DynamiX / apiserver',
  schema: spec.info,
  checksum: crypto.createHash('sha256').update(sourceText).digest('hex'),
  routes,
  operations,
};
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(inventory, null, 2)}\n`);
console.log(`${routes.length} routes · ${operations.length} API operations · ${target}`);
const apiCatalogue = operations.map((op) => ({
  id: op.method + ' ' + op.path,
  path: op.path,
  method: op.method,
  name: op.path.replace('/restmachine/', ''),
  summary: op.summary || '',
  namespace: op.path.split('/')[2],
  group: op.path.split('/').slice(2, -1).join('/'),
  parameters: op.parameters.map(
    ({ name, type, required, description, enum: values, minimum, maximum }) => ({
      name,
      type,
      required,
      description,
      values,
      minimum,
      maximum,
    }),
  ),
}));
fs.writeFileSync(
  path.resolve('apps/cloud/platform-api.json'),
  JSON.stringify(apiCatalogue, null, 2) + '\n',
);
