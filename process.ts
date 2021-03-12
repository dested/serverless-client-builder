//https://github.com/YousefED/typescript-json-schema
import {match} from '@phenomnomnominal/tsquery/dist/src/match';
import * as ejs from 'ejs';
import * as fs from 'fs';
import * as prettier from 'prettier';
import Project, {FileSystemHost, MethodDeclaration, Symbol, SyntaxKind, ts} from 'ts-simple-ast';
import {isKebabCased} from 'tslint/lib/utils';
import {ManageSymbols} from './manageSymbols';
import {buildValidatorMethod, validationMethods} from './validationTester';

const requestSymbolManager = new ManageSymbols();

export function processFile(
  apiPath: string,
  outputFiles: string[],
  noValidation: boolean,
  noYaml: boolean,
  templateV2: boolean,
  templateV3: boolean,
  openApi: string
) {
  const templateVersion = templateV2 ? './templateV2.ejs' : templateV3 ? './templateV3.ejs' : './template.ejs';

  console.time('parse');
  const tsConfigFilePath = apiPath + 'tsconfig.json';

  const project = new Project({
    tsConfigFilePath,
  });
  console.timeEnd('parse');

  console.time('get controllers');

  const symbolManager = new ManageSymbols();
  const controllerDataItems: ControllerData[] = [];
  for (const sourceFile of project.getSourceFiles()) {
    for (const classDeclaration of sourceFile.getDescendantsOfKind(SyntaxKind.ClassDeclaration)) {
      const classDecorator = classDeclaration.getDecorators()[0];

      if (classDecorator && classDecorator.getName() === 'controller') {
        const controllerName = classDecorator.getArguments()[0].getText();

        const controllerData: ControllerData = {
          name: eval(controllerName),
          methods: [],
          websockets: [],
          websocketEvents: [],
          events: [],
          options: [],
        };

        if (classDecorator.getArguments()[1]) {
          const text = classDecorator.getArguments()[1].getText();
          const requestOptions = eval('(' + text + ')');
          if (requestOptions) {
            if (openApi && !requestOptions.openApi) {
              continue;
            }
            for (const key of Object.keys(requestOptions)) {
              if (key === 'route') {
                controllerData.route = requestOptions[key];
              } else {
                controllerData.options.push({key, value: requestOptions[key]});
              }
            }
          }
        }
        controllerDataItems.push(controllerData);
        for (const declaration of classDeclaration.getMethods()) {
          for (const decorator of declaration.getDecorators()) {
            if (decorator.getName() === 'request') {
              const name = declaration.getName();
              const method = eval(decorator.getArguments()[0].getText());
              const path = eval(decorator.getArguments()[1].getText());
              const options: {key: string; value: any}[] = [];
              assert(!!decorator.getArguments()[2], `Missing options arg ${name}`);
              const text = decorator.getArguments()[2].getText();
              const requestOptions = eval('(' + text + ')');
              assert(!!requestOptions, `Missing options arg ${name}`);
              assert(Array.isArray(requestOptions.statusCodes), `Missing status code arg ${name}`);
              for (const key of Object.keys(requestOptions)) {
                options.push({key, value: requestOptions[key]});
              }
              controllerData.methods.push({
                controllerName: classDeclaration.getName().replace('Controller', ''),
                name,
                method,
                path,
                declaration,
                options,
              });
            }
            if (decorator.getName() === 'event') {
              const methodName = declaration.getName();
              const rate: string = eval(decorator.getArguments()[0].getText());

              const data = controllerData.events.find(a => a.name === methodName);
              const options: {key: string; value: any}[] = [];
              if (decorator.getArguments()[1]) {
                const text = decorator.getArguments()[1].getText();
                const requestOptions = eval('(' + text + ')');
                if (requestOptions) {
                  for (const key of Object.keys(requestOptions)) {
                    options.push({key, value: requestOptions[key]});
                  }
                }
              }
              if (data) {
                data.rate.push(rate);
              } else {
                controllerData.events.push({
                  options,
                  controllerName: controllerData.name,
                  name: methodName,
                  rate: [rate],
                  declaration,
                });
              }
            }
            if (decorator.getName() === 'websocketRequest') {
              const methodName = declaration.getName();
              const routeKey: string = eval(decorator.getArguments()[0].getText());
              const data = controllerData.websockets.find(a => a.name === methodName);
              if (data) {
                data.routeKey.push(routeKey);
              } else {
                controllerData.websockets.push({
                  controllerName: controllerData.name,
                  name: methodName,
                  routeKey: [routeKey],
                  declaration,
                });
              }
            }
            if (decorator.getName() === 'websocketEvent') {
              const methodName = declaration.getName();
              const routeKey: string = eval(decorator.getArguments()[0].getText());
              controllerData.websocketEvents.push({
                controllerName: controllerData.name,
                name: methodName,
                routeKey,
                declaration,
              });
            }
          }
        }
      }
    }
  }
  console.timeEnd('get controllers');
  if (!noYaml) {
    console.time('write yaml');

    const disclaimer = '# This file was generated by https://github.com/dested/serverless-client-builder\r\n';
    const header = fs.readFileSync(apiPath + 'serverless-header.yml', {encoding: 'utf8'});

    let mainServerless = disclaimer + header;
    mainServerless += `
  all:
    handler: handler.all
    events:
      - http:
          path: /
          method: any
          cors:
            origin: '*'
            headers:
              - Content-Type
              - Authorization
              - timezone
              - version
      - http:
          path: /{any+}
          method: any
          cors:
            origin: '*'
            headers:
              - Content-Type
              - Authorization
              - timezone
              - version
`;

    for (const controllerDataItem of controllerDataItems) {
      for (const method of controllerDataItem.methods.filter(a => a.options.find(b => b.key === 'bespoke'))) {
        const options = method.options
          .filter(a => a.key !== 'bespoke')
          .map(a => `    ${a.key}: ${a.value}`)
          .join('\r\n');

        mainServerless += `
  ${controllerDataItem.name}_${method.name}:
    handler: handler.${controllerDataItem.name}_${method.name}
${options + '\r\n'}    events:
      - http:
          path: ${controllerDataItem.name}/${method.path}
          method: ${method.method}
          cors: 
            origin: '*'
            headers:
              - Content-Type
              - Authorization
              - timezone
              - version
`;
      }

      for (const event of controllerDataItem.events) {
        mainServerless += `
  ${controllerDataItem.name}_${event.name}:
    handler: handler.${controllerDataItem.name}_${event.name}
${event.options.map(a => `    ${a.key}: ${a.value}`).join('\r\n') + '\r\n'}    events:
${event.rate.map(a => `      - schedule: ${a}`).join('\r\n') + '\r\n'}`;
      }

      for (const websocket of controllerDataItem.websockets) {
        mainServerless += `
  ${controllerDataItem.name}_${websocket.name}:
    handler: handler.${controllerDataItem.name}_${websocket.name}
    events:
${websocket.routeKey
  .map(
    a => `      - websocket: 
         route: ${a}`
  )
  .join('\r\n')}`;
      }
    }
    fs.writeFileSync(apiPath + 'serverless.yml', mainServerless, {encoding: 'utf8'});
    console.timeEnd('write yaml');
  }

  console.time('parse controllers');
  for (const controllerDataItem of controllerDataItems) {
    for (const method of controllerDataItem.methods) {
      const funcName = method.name;

      const funcNode = method.declaration;

      assert(funcNode.getParameters().length >= 1, 'The export must have a request model parameter');
      const eventArg = funcNode.getParameters()[0].getType();
      const typeArgument = eventArg;
      let requestName: string;

      symbolManager.addSymbol(typeArgument, true);
      requestName = typeArgument.getSymbol().getName();
      requestSymbolManager.addSymbol(typeArgument, true);

      const returnType = funcNode.getReturnType();
      assert(returnType.getSymbol().getName() === 'Promise', 'Return type must must be a promise');
      const returnTypeArgument = returnType.getTypeArguments()[0];
      const httpResponseTypeArgument = returnTypeArgument;

      symbolManager.addSymbol(httpResponseTypeArgument, true);
      addFunction(
        method.controllerName,
        funcName,
        requestName,
        httpResponseTypeArgument.getSymbol().getName(),
        method.options.find(a => a.key === 'statusCodes').value,
        `/${controllerDataItem.route || controllerDataItem.name}/${method.path}`,
        method.method,
        method.options.find(a => a.key === 'description')?.value,
        !!method.options.find(a => a.key === 'auth')?.value
      );
    }
    for (const websocket of controllerDataItem.websockets) {
      if (websocket.routeKey.find(a => a[0] === '$')) {
        continue;
      }

      const funcName = websocket.name;
      const funcNode = websocket.declaration;

      assert(funcNode.getParameters().length === 1, `${funcName} The export must only have one parameter`);
      const eventArg = funcNode.getParameters()[0].getType();
      assert(
        eventArg.getSymbol().getName() === 'WebsocketRequestEvent',
        'WebsocketRequestEvent argument must be a generic event class'
      );
      const typeArgument = eventArg.getTypeArguments()[0];
      let requestName: string;
      symbolManager.addSymbol(typeArgument, true);
      requestSymbolManager.addSymbol(typeArgument, true);
      requestName = typeArgument.getSymbol().getName();

      addWebsocketFunction(websocket.controllerName, funcName, requestName, websocket.routeKey[0]);
    }
    for (const websocketEvent of controllerDataItem.websocketEvents) {
      const funcName = websocketEvent.name;
      const funcNode = websocketEvent.declaration;

      let found = false;
      for (const parameter of funcNode.getParameters()) {
        const eventArg = parameter.getType();
        if (eventArg.getSymbol().getName() === 'WebSocketResponse') {
          const typeArgument = eventArg.getTypeArguments()[0];
          let requestName: string;
          symbolManager.addSymbol(typeArgument, true);
          requestName = typeArgument.getSymbol().getName();
          addWebsocketEvent(websocketEvent.controllerName, funcName, requestName, websocketEvent.routeKey);
          found = true;
          break;
        }
      }

      if (!found) {
        assert(false, 'WebSocketEvent argument must be a generic event class');
      }
    }
  }

  console.timeEnd('parse controllers');
  if (!openApi) {
    console.time('write template');

    let js = ejs.render(
      fs.readFileSync(require.resolve(templateVersion), {encoding: 'utf8'}),
      {
        interfaces: symbolManager.symbols.map(a => getSource(a)),
        controllers,
      },
      {escape: e => e}
    );

    for (const outputFile of outputFiles) {
      fs.writeFileSync(outputFile, js, {encoding: 'utf8'});
    }

    const prettierFile = apiPath + '.prettierrc';
    const prettierOptions = readJson(prettierFile);
    if (prettierOptions) {
      prettierOptions.parser = 'typescript';
      js = prettier.format(js, prettierOptions);
    }

    for (const outputFile of outputFiles) {
      fs.writeFileSync(outputFile, js, {encoding: 'utf8'});
    }
    console.timeEnd('write template');
  }

  if (openApi) {
    console.time('write openapi template');
    const interfaces = symbolManager.symbolTypes
      .filter(a => !a.isUnion())
      .map(a => {
        return {
          name: (a.getSymbol() || a.getAliasSymbol()).getEscapedName(),
          fields: a.getProperties().map(topP => {
            function getType(p: Symbol) {
              const typeV = p.getDeclarations()[0].getType();
              let type: string;
              if (typeV.isUnion() && typeV.getText() !== 'boolean') {
                type = `
          enum:`;
                for (const unionType of typeV.getUnionTypes()) {
                  type += `
            - ${unionType.getText()}`;
                }
              } else {
                switch (typeV.getSymbol()?.getEscapedName() ?? typeV.getText()) {
                  case 'string':
                  case 'number':
                  case 'boolean':
                    type = 'type: ' + typeV.getText();
                    break;
                  case 'Array':
                    if (typeV.getArrayType().getSymbol()) {
                      type = `type: array
          items:
            $ref: '#/components/schemas/${typeV
              .getArrayType()
              .getSymbol()
              .getEscapedName()}'`;
                    } else {
                      type = `type: array
          items:
            type: ${typeV.getArrayType().getText()}`;
                    }

                    break;
                  default:
                    type = `
          $ref: '#/components/schemas/${(typeV.getSymbol() ?? typeV.getAliasSymbol()).getEscapedName()}'`;
                }
              }
              return type;
            }

            return {
              name: topP.getEscapedName(),
              type: getType(topP),
            };
          }),
        };
      });
    const apiJs = ejs.render(
      fs.readFileSync(require.resolve('./openApiTemplate.ejs'), {encoding: 'utf8'}),
      {
        interfaces,
        controllers,
      },
      {escape: e => e}
    );

    const header = fs.readFileSync(apiPath + 'openApi-header.yaml', {encoding: 'utf8'});

    fs.writeFileSync(openApi, header + apiJs, {encoding: 'utf8'});
    console.timeEnd('write openapi template');
  }

  if (!noValidation) {
    console.time('validator');
    buildValidator(apiPath);
    console.timeEnd('validator');
  }
}

function assert(thing: boolean, error: string) {
  if (!thing) {
    throw error;
  }
}

const readJson = (path: string) => {
  if (fs.existsSync(path)) {
    return JSON.parse(fs.readFileSync(path, {encoding: 'utf8'}));
  }
  return null;
};

function buildValidator(apiPath: string) {
  for (const type of requestSymbolManager.types) {
    const declaredType = type.getSymbol().getDeclaredType();
    const apiFullPath = fs.realpathSync(apiPath).replace(/\\/g, '/');
    const text = declaredType.getText().replace(apiFullPath, '..');
    buildValidatorMethod(apiFullPath, type.getSymbol().getName(), text, type);
  }
  let js = `
/* This file was generated by https://github.com/dested/serverless-client-builder */
/* tslint:disable */
  

export class ValidationError extends Error {
  isValidationError=true;
  constructor(public model: string, public reason: 'missing' | 'mismatch' | 'too-many-fields', public field: string) {
    super();
  }
}
  

export class RequestModelValidator {
${validationMethods.join('\r\n')}
}
`;

  fs.writeFileSync(apiPath + 'utils/validation.ts', js, {encoding: 'utf8'});

  const prettierFile = apiPath + '.prettierrc';
  const prettierOptions = readJson(prettierFile);
  if (prettierOptions) {
    prettierOptions.parser = 'typescript';
    js = prettier.format(js, prettierOptions);
  }

  fs.writeFileSync(apiPath + 'utils/validation.ts', js, {encoding: 'utf8'});
}

const controllers: {
  controllerName: string;
  functions: {
    url: string;
    method: string;
    name: string;
    requestType: string;
    returnType: string;
    errorTypes: number[];
    urlReplaces: string[];
    handleType: string;
    description: string;
    auth: boolean;
  }[];
  websocketFunctions: {
    route: string;
    name: string;
    requestType: string;
  }[];
  websocketEvents: {
    route: string;
    name: string;
    requestType: string;
  }[];
}[] = [];

function addFunction(
  controllerName: string,
  name: string,
  requestType: string,
  returnType: string,
  errorTypes: number[],
  url: string,
  method: string,
  description: string,
  auth: boolean
) {
  if (!errorTypes.find(a => a === 401)) errorTypes.push(401);
  const handleType = `{200?:(result:${returnType})=>void,500?:(result:string)=>void,${errorTypes
    .map(a => {
      const statusCode = a;
      if (statusCode === 401) {
        return `${statusCode}?:(error:string)=>void`;
      } else {
        return `${statusCode}:(result:{error:string})=>void`;
      }
    })
    .join(',')}}`;

  let controller = controllers.find(a => a.controllerName === controllerName);
  if (!controller) {
    controller = {controllerName, functions: [], websocketFunctions: [], websocketEvents: []};
    controllers.push(controller);
  }

  const urlReplaces = [...matchAll(/:(\w+)/g, url), ...matchAll(/{(\w+)}/g, url)];
  controller.functions.push({
    name,
    handleType,
    requestType,
    returnType,
    url,
    urlReplaces,
    method,
    errorTypes,
    description,
    auth,
  });
}
function addWebsocketFunction(controllerName: string, name: string, requestType: string, route: string) {
  let controller = controllers.find(a => a.controllerName === controllerName);
  if (!controller) {
    controller = {controllerName, functions: [], websocketFunctions: [], websocketEvents: []};
    controllers.push(controller);
  }
  controller.websocketFunctions.push({
    name,
    requestType,
    route,
  });
}
function addWebsocketEvent(controllerName: string, name: string, requestType: string, route: string) {
  let controller = controllers.find(a => a.controllerName === controllerName);
  if (!controller) {
    controller = {controllerName, functions: [], websocketFunctions: [], websocketEvents: []};
    controllers.push(controller);
  }
  controller.websocketEvents.push({
    name,
    requestType,
    route,
  });
}

function kebabToCamel(name: string) {
  return name.replace(/-([a-z])/g, g => {
    return g[1].toUpperCase();
  });
}

function matchAll(re: RegExp, str: string) {
  let m;

  const results: string[] = [];

  do {
    m = re.exec(str);
    if (m) {
      results.push(m[1]);
    }
  } while (m);
  return results;
}

function getSource(symbol: ts.Symbol, addExport: boolean = true) {
  return symbol.declarations
    .map(a => {
      let str = a.getText();
      if (addExport && str.indexOf('export') === -1) {
        str = 'export ' + str;
      }
      return str;
    })
    .join('\n');
}

export interface ControllerData {
  route?: string;
  name: string;
  methods: ControllerMethodData[];
  events: ControllerEventData[];
  websockets: ControllerWebsocketData[];
  options: {key: string; value: any}[];
  websocketEvents: ControllerWebsocketEventData[];
}
export interface ControllerMethodData {
  controllerName: string;
  name: string;
  method: string;
  path: string;
  declaration: MethodDeclaration;
  options: {key: string; value: any}[];
}
export interface ControllerEventData {
  controllerName: string;
  name: string;
  rate: string[];
  options: {key: string; value: any}[];
  declaration: MethodDeclaration;
}

export interface ControllerWebsocketData {
  controllerName: string;
  name: string;
  routeKey: string[];
  declaration: MethodDeclaration;
}

export interface ControllerWebsocketEventData {
  controllerName: string;
  name: string;
  routeKey: string;
  declaration: MethodDeclaration;
}
