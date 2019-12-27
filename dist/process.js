"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ejs = require("ejs");
const fs = require("fs");
const prettier = require("prettier");
const ts_simple_ast_1 = require("ts-simple-ast");
const manageSymbols_1 = require("./manageSymbols");
const validationTester_1 = require("./validationTester");
const requestSymbolManager = new manageSymbols_1.ManageSymbols();
function processFile(apiPath, outputFiles, noValidation, noYaml, openApi) {
    console.time('parse');
    const tsConfigFilePath = apiPath + 'tsconfig.json';
    const project = new ts_simple_ast_1.default({
        tsConfigFilePath,
    });
    console.timeEnd('parse');
    console.time('get controllers');
    const symbolManager = new manageSymbols_1.ManageSymbols();
    const controllerDataItems = [];
    for (const sourceFile of project.getSourceFiles()) {
        for (const classDeclaration of sourceFile.getDescendantsOfKind(ts_simple_ast_1.SyntaxKind.ClassDeclaration)) {
            const classDecorator = classDeclaration.getDecorators()[0];
            if (classDecorator && classDecorator.getName() === 'controller') {
                const controllerName = classDecorator.getArguments()[0].getText();
                const controllerData = {
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
                            }
                            else {
                                controllerData.options.push({ key, value: requestOptions[key] });
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
                            const options = [];
                            if (decorator.getArguments()[2]) {
                                const text = decorator.getArguments()[2].getText();
                                const requestOptions = eval('(' + text + ')');
                                if (requestOptions) {
                                    for (const key of Object.keys(requestOptions)) {
                                        options.push({ key, value: requestOptions[key] });
                                    }
                                }
                            }
                            controllerData.methods.push({
                                controllerName: controllerData.name,
                                name,
                                method,
                                path,
                                declaration,
                                options,
                            });
                        }
                        if (decorator.getName() === 'event') {
                            const methodName = declaration.getName();
                            const rate = eval(decorator.getArguments()[0].getText());
                            const data = controllerData.events.find(a => a.name === methodName);
                            const options = [];
                            if (decorator.getArguments()[1]) {
                                const text = decorator.getArguments()[1].getText();
                                const requestOptions = eval('(' + text + ')');
                                if (requestOptions) {
                                    for (const key of Object.keys(requestOptions)) {
                                        options.push({ key, value: requestOptions[key] });
                                    }
                                }
                            }
                            if (data) {
                                data.rate.push(rate);
                            }
                            else {
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
                            const routeKey = eval(decorator.getArguments()[0].getText());
                            const data = controllerData.websockets.find(a => a.name === methodName);
                            if (data) {
                                data.routeKey.push(routeKey);
                            }
                            else {
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
                            const routeKey = eval(decorator.getArguments()[0].getText());
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
        const header = fs.readFileSync(apiPath + 'serverless-header.yml', { encoding: 'utf8' });
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
${websocket.routeKey.map(a => `      - websocket: ${a}`).join('\r\n')}`;
            }
        }
        fs.writeFileSync(apiPath + 'serverless.yml', mainServerless, { encoding: 'utf8' });
        console.timeEnd('write yaml');
    }
    console.time('parse controllers');
    console.profile('controllers');
    for (const controllerDataItem of controllerDataItems) {
        for (const method of controllerDataItem.methods) {
            const funcName = method.name;
            const funcNode = method.declaration;
            assert(funcNode.getParameters().length === 1, 'The export must only have one parameter');
            const eventArg = funcNode.getParameters()[0].getType();
            assert(eventArg.getSymbol().getName() === 'RequestEvent' || eventArg.getSymbol().getName() === 'GetRequestEvent', 'RequestEvent argument must be a generic event class');
            const typeArgument = eventArg.getTypeArguments()[0];
            let requestName;
            symbolManager.addSymbol(typeArgument, true);
            requestName = typeArgument.getSymbol().getName();
            requestSymbolManager.addSymbol(typeArgument, true);
            const returnType = funcNode.getReturnType();
            assert(returnType.getSymbol().getName() === 'Promise', 'Return type must must be a promise');
            const returnTypeArgument = returnType.getTypeArguments()[0];
            assert(returnTypeArgument.getSymbol().getName() === 'HttpResponse', 'Return type must must be a promise of HttpResponse');
            const httpResponseTypeArgument = returnTypeArgument.getTypeArguments()[0];
            const httpResponseErrorArgument = returnTypeArgument.getTypeArguments()[1];
            const errorTypes = [];
            if (httpResponseErrorArgument.compilerType.intrinsicName !== 'undefined') {
                if (httpResponseErrorArgument.getUnionTypes().length === 0) {
                    errorTypes.push(httpResponseErrorArgument.getApparentType().compilerType.getSymbol());
                }
                else {
                    for (const unionType of httpResponseErrorArgument.getUnionTypes()) {
                        errorTypes.push(unionType.compilerType.getSymbol());
                    }
                }
            }
            symbolManager.addSymbol(httpResponseTypeArgument, true);
            addFunction(method.controllerName, funcName, requestName, httpResponseTypeArgument.getSymbol().getName(), errorTypes, `/${controllerDataItem.route || controllerDataItem.name}/${method.path}`, method.method, method.options.find(a => a.key === 'description').value);
        }
        for (const websocket of controllerDataItem.websockets) {
            if (websocket.routeKey.find(a => a[0] === '$')) {
                continue;
            }
            const funcName = websocket.name;
            const funcNode = websocket.declaration;
            assert(funcNode.getParameters().length === 1, 'The export must only have one parameter');
            const eventArg = funcNode.getParameters()[0].getType();
            assert(eventArg.getSymbol().getName() === 'WebsocketRequestEvent', 'WebsocketRequestEvent argument must be a generic event class');
            const typeArgument = eventArg.getTypeArguments()[0];
            let requestName;
            symbolManager.addSymbol(typeArgument, true);
            requestSymbolManager.addSymbol(typeArgument, true);
            requestName = typeArgument.getSymbol().getName();
            addWebsocketFunction(websocket.controllerName, funcName, requestName, websocket.routeKey[0]);
        }
        for (const websocketEvent of controllerDataItem.websocketEvents) {
            const funcName = websocketEvent.name;
            const funcNode = websocketEvent.declaration;
            assert(funcNode.getParameters().length === 3, `The export must only have three parameters: ${websocketEvent.name} ${funcNode.getParameters().length}`);
            const eventArg = funcNode.getParameters()[2].getType();
            assert(eventArg.getSymbol().getName() === 'WebSocketResponse', 'WebSocketEvent argument must be a generic event class');
            const typeArgument = eventArg.getTypeArguments()[0];
            let requestName;
            symbolManager.addSymbol(typeArgument, true);
            requestName = typeArgument.getSymbol().getName();
            addWebsocketEvent(websocketEvent.controllerName, funcName, requestName, websocketEvent.routeKey);
        }
    }
    console.profileEnd();
    console.timeEnd('parse controllers');
    if (!openApi) {
        console.time('write template');
        let js = ejs.render(fs.readFileSync(require.resolve('./template.ejs'), { encoding: 'utf8' }), {
            interfaces: symbolManager.symbols.map(a => getSource(a)),
            controllers,
        }, { escape: e => e });
        for (const outputFile of outputFiles) {
            fs.writeFileSync(outputFile, js, { encoding: 'utf8' });
        }
        const prettierFile = apiPath + '.prettierrc';
        const prettierOptions = readJson(prettierFile);
        if (prettierOptions) {
            prettierOptions.parser = 'typescript';
            js = prettier.format(js, prettierOptions);
        }
        for (const outputFile of outputFiles) {
            fs.writeFileSync(outputFile, js, { encoding: 'utf8' });
        }
        console.timeEnd('write template');
    }
    if (openApi) {
        console.time('write openapi template');
        const interfaces = symbolManager.symbolTypes.map(a => {
            return {
                name: a.getSymbol().getEscapedName(),
                fields: a.getProperties().map(p => {
                    var _a, _b;
                    const typeV = p.getDeclarations()[0].getType();
                    let type;
                    switch ((_b = (_a = typeV.getSymbol()) === null || _a === void 0 ? void 0 : _a.getEscapedName(), (_b !== null && _b !== void 0 ? _b : typeV.getText()))) {
                        case 'string':
                        case 'number':
                        case 'boolean':
                            type = typeV.getText();
                            break;
                        case 'Array':
                            if (typeV.getArrayType().getSymbol()) {
                                type = `array
          items:
            $ref: '#/components/schemas/${typeV
                                    .getArrayType()
                                    .getSymbol()
                                    .getEscapedName()}'`;
                            }
                            else {
                                type = `array
          items:
            type: ${typeV.getArrayType().getText()}`;
                            }
                            break;
                        default:
                            type = `
          $ref: '#/components/schemas/${typeV.getSymbol().getEscapedName()}'`;
                    }
                    return {
                        name: p.getEscapedName(),
                        type,
                    };
                }),
            };
        });
        const apiJs = ejs.render(fs.readFileSync(require.resolve('./openApiTemplate.ejs'), { encoding: 'utf8' }), {
            interfaces,
            controllers,
        }, { escape: e => e });
        const header = fs.readFileSync(apiPath + 'openApi-header.yaml', { encoding: 'utf8' });
        fs.writeFileSync(openApi, header + apiJs, { encoding: 'utf8' });
        console.timeEnd('write openapi template');
    }
    if (!noValidation) {
        console.time('validator');
        buildValidator(apiPath);
        console.timeEnd('validator');
    }
}
exports.processFile = processFile;
function assert(thing, error) {
    if (!thing) {
        throw error;
    }
}
const readJson = (path) => {
    if (fs.existsSync(path)) {
        return JSON.parse(fs.readFileSync(path, { encoding: 'utf8' }));
    }
    return null;
};
function buildValidator(apiPath) {
    for (const type of requestSymbolManager.types) {
        const declaredType = type.getSymbol().getDeclaredType();
        const apiFullPath = fs.realpathSync(apiPath).replace(/\\/g, '/');
        const text = declaredType.getText().replace(apiFullPath, '..');
        validationTester_1.buildValidatorMethod(apiFullPath, type.getSymbol().getName(), text, type);
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
${validationTester_1.validationMethods.join('\r\n')}
}
`;
    fs.writeFileSync(apiPath + 'utils/validation.ts', js, { encoding: 'utf8' });
    const prettierFile = apiPath + '.prettierrc';
    const prettierOptions = readJson(prettierFile);
    if (prettierOptions) {
        prettierOptions.parser = 'typescript';
        js = prettier.format(js, prettierOptions);
    }
    fs.writeFileSync(apiPath + 'utils/validation.ts', js, { encoding: 'utf8' });
}
const controllers = [];
function getSourceWithoutStatusCode(a) {
    const source = getSource(a, false);
    return source.replace(/statusCode\s*:\s*\d+,?;?/g, '');
}
function addFunction(controllerName, name, requestType, returnType, errorTypes, url, method, description) {
    const errorCode = errorTypes.map(a => a.members.get('statusCode').valueDeclaration.type.literal.text);
    const handleType = `{200?:(result:${returnType})=>TPromise,500?:(result:string)=>void,${errorTypes
        .map(a => {
        const statusCode = a.members.get('statusCode').valueDeclaration.type.literal.text;
        const source = getSourceWithoutStatusCode(a);
        if (statusCode === '401') {
            return `${statusCode}?:(error:string)=>void`;
        }
        else {
            return `${statusCode}:(result:${source})=>void`;
        }
    })
        .join(',')}}`;
    let controller = controllers.find(a => a.controllerName === controllerName);
    if (!controller) {
        controller = { controllerName, functions: [], websocketFunctions: [], websocketEvents: [] };
        controllers.push(controller);
    }
    const urlReplaces = matchAll(/{(\w+)}/g, url);
    controller.functions.push({
        name,
        handleType,
        requestType,
        returnType,
        url,
        urlReplaces,
        method,
        errorCode,
        description,
    });
}
function addWebsocketFunction(controllerName, name, requestType, route) {
    let controller = controllers.find(a => a.controllerName === controllerName);
    if (!controller) {
        controller = { controllerName, functions: [], websocketFunctions: [], websocketEvents: [] };
        controllers.push(controller);
    }
    controller.websocketFunctions.push({
        name,
        requestType,
        route,
    });
}
function addWebsocketEvent(controllerName, name, requestType, route) {
    let controller = controllers.find(a => a.controllerName === controllerName);
    if (!controller) {
        controller = { controllerName, functions: [], websocketFunctions: [], websocketEvents: [] };
        controllers.push(controller);
    }
    controller.websocketEvents.push({
        name,
        requestType,
        route,
    });
}
function kebabToCamel(name) {
    return name.replace(/-([a-z])/g, g => {
        return g[1].toUpperCase();
    });
}
function matchAll(re, str) {
    let m;
    const results = [];
    do {
        m = re.exec(str);
        if (m) {
            results.push(m[1]);
        }
    } while (m);
    return results;
}
function getSource(symbol, addExport = true) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3Byb2Nlc3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSwyQkFBMkI7QUFDM0IseUJBQXlCO0FBQ3pCLHFDQUFxQztBQUNyQyxpREFBeUY7QUFFekYsbURBQThDO0FBQzlDLHlEQUEyRTtBQUUzRSxNQUFNLG9CQUFvQixHQUFHLElBQUksNkJBQWEsRUFBRSxDQUFDO0FBRWpELFNBQWdCLFdBQVcsQ0FDekIsT0FBZSxFQUNmLFdBQXFCLEVBQ3JCLFlBQXFCLEVBQ3JCLE1BQWUsRUFDZixPQUFlO0lBRWYsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN0QixNQUFNLGdCQUFnQixHQUFHLE9BQU8sR0FBRyxlQUFlLENBQUM7SUFFbkQsTUFBTSxPQUFPLEdBQUcsSUFBSSx1QkFBTyxDQUFDO1FBQzFCLGdCQUFnQjtLQUNqQixDQUFDLENBQUM7SUFDSCxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBRXpCLE9BQU8sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUVoQyxNQUFNLGFBQWEsR0FBRyxJQUFJLDZCQUFhLEVBQUUsQ0FBQztJQUMxQyxNQUFNLG1CQUFtQixHQUFxQixFQUFFLENBQUM7SUFDakQsS0FBSyxNQUFNLFVBQVUsSUFBSSxPQUFPLENBQUMsY0FBYyxFQUFFLEVBQUU7UUFDakQsS0FBSyxNQUFNLGdCQUFnQixJQUFJLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQywwQkFBVSxDQUFDLGdCQUFnQixDQUFDLEVBQUU7WUFDM0YsTUFBTSxjQUFjLEdBQUcsZ0JBQWdCLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFM0QsSUFBSSxjQUFjLElBQUksY0FBYyxDQUFDLE9BQU8sRUFBRSxLQUFLLFlBQVksRUFBRTtnQkFDL0QsTUFBTSxjQUFjLEdBQUcsY0FBYyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUVsRSxNQUFNLGNBQWMsR0FBbUI7b0JBQ3JDLElBQUksRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDO29CQUMxQixPQUFPLEVBQUUsRUFBRTtvQkFDWCxVQUFVLEVBQUUsRUFBRTtvQkFDZCxlQUFlLEVBQUUsRUFBRTtvQkFDbkIsTUFBTSxFQUFFLEVBQUU7b0JBQ1YsT0FBTyxFQUFFLEVBQUU7aUJBQ1osQ0FBQztnQkFFRixJQUFJLGNBQWMsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRTtvQkFDcEMsTUFBTSxJQUFJLEdBQUcsY0FBYyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO29CQUN4RCxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksR0FBRyxHQUFHLENBQUMsQ0FBQztvQkFDOUMsSUFBSSxjQUFjLEVBQUU7d0JBQ2xCLElBQUksT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFBRTs0QkFDdEMsU0FBUzt5QkFDVjt3QkFDRCxLQUFLLE1BQU0sR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLEVBQUU7NEJBQzdDLElBQUksR0FBRyxLQUFLLE9BQU8sRUFBRTtnQ0FDbkIsY0FBYyxDQUFDLEtBQUssR0FBRyxjQUFjLENBQUMsR0FBRyxDQUFDLENBQUM7NkJBQzVDO2lDQUFNO2dDQUNMLGNBQWMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxjQUFjLENBQUMsR0FBRyxDQUFDLEVBQUMsQ0FBQyxDQUFDOzZCQUNoRTt5QkFDRjtxQkFDRjtpQkFDRjtnQkFDRCxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7Z0JBQ3pDLEtBQUssTUFBTSxXQUFXLElBQUksZ0JBQWdCLENBQUMsVUFBVSxFQUFFLEVBQUU7b0JBQ3ZELEtBQUssTUFBTSxTQUFTLElBQUksV0FBVyxDQUFDLGFBQWEsRUFBRSxFQUFFO3dCQUNuRCxJQUFJLFNBQVMsQ0FBQyxPQUFPLEVBQUUsS0FBSyxTQUFTLEVBQUU7NEJBQ3JDLE1BQU0sSUFBSSxHQUFHLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQzs0QkFDbkMsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDOzRCQUMzRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7NEJBQ3pELE1BQU0sT0FBTyxHQUFtQyxFQUFFLENBQUM7NEJBQ25ELElBQUksU0FBUyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFO2dDQUMvQixNQUFNLElBQUksR0FBRyxTQUFTLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7Z0NBQ25ELE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDO2dDQUM5QyxJQUFJLGNBQWMsRUFBRTtvQ0FDbEIsS0FBSyxNQUFNLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxFQUFFO3dDQUM3QyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxjQUFjLENBQUMsR0FBRyxDQUFDLEVBQUMsQ0FBQyxDQUFDO3FDQUNqRDtpQ0FDRjs2QkFDRjs0QkFDRCxjQUFjLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztnQ0FDMUIsY0FBYyxFQUFFLGNBQWMsQ0FBQyxJQUFJO2dDQUNuQyxJQUFJO2dDQUNKLE1BQU07Z0NBQ04sSUFBSTtnQ0FDSixXQUFXO2dDQUNYLE9BQU87NkJBQ1IsQ0FBQyxDQUFDO3lCQUNKO3dCQUNELElBQUksU0FBUyxDQUFDLE9BQU8sRUFBRSxLQUFLLE9BQU8sRUFBRTs0QkFDbkMsTUFBTSxVQUFVLEdBQUcsV0FBVyxDQUFDLE9BQU8sRUFBRSxDQUFDOzRCQUN6QyxNQUFNLElBQUksR0FBVyxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7NEJBRWpFLE1BQU0sSUFBSSxHQUFHLGNBQWMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxVQUFVLENBQUMsQ0FBQzs0QkFDcEUsTUFBTSxPQUFPLEdBQW1DLEVBQUUsQ0FBQzs0QkFDbkQsSUFBSSxTQUFTLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUU7Z0NBQy9CLE1BQU0sSUFBSSxHQUFHLFNBQVMsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQ0FDbkQsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUM7Z0NBQzlDLElBQUksY0FBYyxFQUFFO29DQUNsQixLQUFLLE1BQU0sR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLEVBQUU7d0NBQzdDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLGNBQWMsQ0FBQyxHQUFHLENBQUMsRUFBQyxDQUFDLENBQUM7cUNBQ2pEO2lDQUNGOzZCQUNGOzRCQUNELElBQUksSUFBSSxFQUFFO2dDQUNSLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDOzZCQUN0QjtpQ0FBTTtnQ0FDTCxjQUFjLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztvQ0FDekIsT0FBTztvQ0FDUCxjQUFjLEVBQUUsY0FBYyxDQUFDLElBQUk7b0NBQ25DLElBQUksRUFBRSxVQUFVO29DQUNoQixJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUM7b0NBQ1osV0FBVztpQ0FDWixDQUFDLENBQUM7NkJBQ0o7eUJBQ0Y7d0JBQ0QsSUFBSSxTQUFTLENBQUMsT0FBTyxFQUFFLEtBQUssa0JBQWtCLEVBQUU7NEJBQzlDLE1BQU0sVUFBVSxHQUFHLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQzs0QkFDekMsTUFBTSxRQUFRLEdBQVcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDOzRCQUNyRSxNQUFNLElBQUksR0FBRyxjQUFjLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssVUFBVSxDQUFDLENBQUM7NEJBQ3hFLElBQUksSUFBSSxFQUFFO2dDQUNSLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDOzZCQUM5QjtpQ0FBTTtnQ0FDTCxjQUFjLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQztvQ0FDN0IsY0FBYyxFQUFFLGNBQWMsQ0FBQyxJQUFJO29DQUNuQyxJQUFJLEVBQUUsVUFBVTtvQ0FDaEIsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDO29DQUNwQixXQUFXO2lDQUNaLENBQUMsQ0FBQzs2QkFDSjt5QkFDRjt3QkFDRCxJQUFJLFNBQVMsQ0FBQyxPQUFPLEVBQUUsS0FBSyxnQkFBZ0IsRUFBRTs0QkFDNUMsTUFBTSxVQUFVLEdBQUcsV0FBVyxDQUFDLE9BQU8sRUFBRSxDQUFDOzRCQUN6QyxNQUFNLFFBQVEsR0FBVyxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7NEJBQ3JFLGNBQWMsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDO2dDQUNsQyxjQUFjLEVBQUUsY0FBYyxDQUFDLElBQUk7Z0NBQ25DLElBQUksRUFBRSxVQUFVO2dDQUNoQixRQUFRO2dDQUNSLFdBQVc7NkJBQ1osQ0FBQyxDQUFDO3lCQUNKO3FCQUNGO2lCQUNGO2FBQ0Y7U0FDRjtLQUNGO0lBQ0QsT0FBTyxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ25DLElBQUksQ0FBQyxNQUFNLEVBQUU7UUFDWCxPQUFPLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBRTNCLE1BQU0sVUFBVSxHQUFHLHNGQUFzRixDQUFDO1FBQzFHLE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsT0FBTyxHQUFHLHVCQUF1QixFQUFFLEVBQUMsUUFBUSxFQUFFLE1BQU0sRUFBQyxDQUFDLENBQUM7UUFFdEYsSUFBSSxjQUFjLEdBQUcsVUFBVSxHQUFHLE1BQU0sQ0FBQztRQUN6QyxjQUFjLElBQUk7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXdCckIsQ0FBQztRQUVFLEtBQUssTUFBTSxrQkFBa0IsSUFBSSxtQkFBbUIsRUFBRTtZQUNwRCxLQUFLLE1BQU0sTUFBTSxJQUFJLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssU0FBUyxDQUFDLENBQUMsRUFBRTtnQkFDckcsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLE9BQU87cUJBQzNCLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssU0FBUyxDQUFDO3FCQUNoQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDO3FCQUNwQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBRWhCLGNBQWMsSUFBSTtJQUN0QixrQkFBa0IsQ0FBQyxJQUFJLElBQUksTUFBTSxDQUFDLElBQUk7dUJBQ25CLGtCQUFrQixDQUFDLElBQUksSUFBSSxNQUFNLENBQUMsSUFBSTtFQUMzRCxPQUFPLEdBQUcsTUFBTTs7a0JBRUEsa0JBQWtCLENBQUMsSUFBSSxJQUFJLE1BQU0sQ0FBQyxJQUFJO29CQUNwQyxNQUFNLENBQUMsTUFBTTs7Ozs7Ozs7Q0FRaEMsQ0FBQzthQUNLO1lBRUQsS0FBSyxNQUFNLEtBQUssSUFBSSxrQkFBa0IsQ0FBQyxNQUFNLEVBQUU7Z0JBQzdDLGNBQWMsSUFBSTtJQUN0QixrQkFBa0IsQ0FBQyxJQUFJLElBQUksS0FBSyxDQUFDLElBQUk7dUJBQ2xCLGtCQUFrQixDQUFDLElBQUksSUFBSSxLQUFLLENBQUMsSUFBSTtFQUMxRCxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsTUFBTTtFQUN4RSxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLHFCQUFxQixDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQzthQUNqRTtZQUVELEtBQUssTUFBTSxTQUFTLElBQUksa0JBQWtCLENBQUMsVUFBVSxFQUFFO2dCQUNyRCxjQUFjLElBQUk7SUFDdEIsa0JBQWtCLENBQUMsSUFBSSxJQUFJLFNBQVMsQ0FBQyxJQUFJO3VCQUN0QixrQkFBa0IsQ0FBQyxJQUFJLElBQUksU0FBUyxDQUFDLElBQUk7O0VBRTlELFNBQVMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsc0JBQXNCLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7YUFDakU7U0FDRjtRQUNELEVBQUUsQ0FBQyxhQUFhLENBQUMsT0FBTyxHQUFHLGdCQUFnQixFQUFFLGNBQWMsRUFBRSxFQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUMsQ0FBQyxDQUFDO1FBQ2pGLE9BQU8sQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUM7S0FDL0I7SUFFRCxPQUFPLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7SUFDbEMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUMvQixLQUFLLE1BQU0sa0JBQWtCLElBQUksbUJBQW1CLEVBQUU7UUFDcEQsS0FBSyxNQUFNLE1BQU0sSUFBSSxrQkFBa0IsQ0FBQyxPQUFPLEVBQUU7WUFDL0MsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQztZQUU3QixNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDO1lBRXBDLE1BQU0sQ0FBQyxRQUFRLENBQUMsYUFBYSxFQUFFLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSx5Q0FBeUMsQ0FBQyxDQUFDO1lBQ3pGLE1BQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN2RCxNQUFNLENBQ0osUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDLE9BQU8sRUFBRSxLQUFLLGNBQWMsSUFBSSxRQUFRLENBQUMsU0FBUyxFQUFFLENBQUMsT0FBTyxFQUFFLEtBQUssaUJBQWlCLEVBQ3pHLHFEQUFxRCxDQUN0RCxDQUFDO1lBQ0YsTUFBTSxZQUFZLEdBQUcsUUFBUSxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDcEQsSUFBSSxXQUFtQixDQUFDO1lBRXhCLGFBQWEsQ0FBQyxTQUFTLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQzVDLFdBQVcsR0FBRyxZQUFZLENBQUMsU0FBUyxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDakQsb0JBQW9CLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQztZQUVuRCxNQUFNLFVBQVUsR0FBRyxRQUFRLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDNUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxPQUFPLEVBQUUsS0FBSyxTQUFTLEVBQUUsb0NBQW9DLENBQUMsQ0FBQztZQUM3RixNQUFNLGtCQUFrQixHQUFHLFVBQVUsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzVELE1BQU0sQ0FDSixrQkFBa0IsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxPQUFPLEVBQUUsS0FBSyxjQUFjLEVBQzNELG9EQUFvRCxDQUNyRCxDQUFDO1lBQ0YsTUFBTSx3QkFBd0IsR0FBRyxrQkFBa0IsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzFFLE1BQU0seUJBQXlCLEdBQUcsa0JBQWtCLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUUzRSxNQUFNLFVBQVUsR0FBZ0IsRUFBRSxDQUFDO1lBRW5DLElBQUsseUJBQXlCLENBQUMsWUFBb0IsQ0FBQyxhQUFhLEtBQUssV0FBVyxFQUFFO2dCQUNqRixJQUFJLHlCQUF5QixDQUFDLGFBQWEsRUFBRSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7b0JBQzFELFVBQVUsQ0FBQyxJQUFJLENBQUMseUJBQXlCLENBQUMsZUFBZSxFQUFFLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUM7aUJBQ3ZGO3FCQUFNO29CQUNMLEtBQUssTUFBTSxTQUFTLElBQUkseUJBQXlCLENBQUMsYUFBYSxFQUFFLEVBQUU7d0JBQ2pFLFVBQVUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDO3FCQUNyRDtpQkFDRjthQUNGO1lBQ0QsYUFBYSxDQUFDLFNBQVMsQ0FBQyx3QkFBd0IsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUN4RCxXQUFXLENBQ1QsTUFBTSxDQUFDLGNBQWMsRUFDckIsUUFBUSxFQUNSLFdBQVcsRUFDWCx3QkFBd0IsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxPQUFPLEVBQUUsRUFDOUMsVUFBVSxFQUNWLElBQUksa0JBQWtCLENBQUMsS0FBSyxJQUFJLGtCQUFrQixDQUFDLElBQUksSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFLEVBQ3hFLE1BQU0sQ0FBQyxNQUFNLEVBQ2IsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLGFBQWEsQ0FBQyxDQUFDLEtBQUssQ0FDeEQsQ0FBQztTQUNIO1FBQ0QsS0FBSyxNQUFNLFNBQVMsSUFBSSxrQkFBa0IsQ0FBQyxVQUFVLEVBQUU7WUFDckQsSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsRUFBRTtnQkFDOUMsU0FBUzthQUNWO1lBRUQsTUFBTSxRQUFRLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQztZQUNoQyxNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsV0FBVyxDQUFDO1lBRXZDLE1BQU0sQ0FBQyxRQUFRLENBQUMsYUFBYSxFQUFFLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSx5Q0FBeUMsQ0FBQyxDQUFDO1lBQ3pGLE1BQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN2RCxNQUFNLENBQ0osUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDLE9BQU8sRUFBRSxLQUFLLHVCQUF1QixFQUMxRCw4REFBOEQsQ0FDL0QsQ0FBQztZQUNGLE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3BELElBQUksV0FBbUIsQ0FBQztZQUN4QixhQUFhLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQztZQUM1QyxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ25ELFdBQVcsR0FBRyxZQUFZLENBQUMsU0FBUyxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUM7WUFFakQsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUM5RjtRQUNELEtBQUssTUFBTSxjQUFjLElBQUksa0JBQWtCLENBQUMsZUFBZSxFQUFFO1lBQy9ELE1BQU0sUUFBUSxHQUFHLGNBQWMsQ0FBQyxJQUFJLENBQUM7WUFDckMsTUFBTSxRQUFRLEdBQUcsY0FBYyxDQUFDLFdBQVcsQ0FBQztZQUU1QyxNQUFNLENBQ0osUUFBUSxDQUFDLGFBQWEsRUFBRSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQ3JDLCtDQUErQyxjQUFjLENBQUMsSUFBSSxJQUFJLFFBQVEsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FDeEcsQ0FBQztZQUNGLE1BQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN2RCxNQUFNLENBQ0osUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDLE9BQU8sRUFBRSxLQUFLLG1CQUFtQixFQUN0RCx1REFBdUQsQ0FDeEQsQ0FBQztZQUNGLE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3BELElBQUksV0FBbUIsQ0FBQztZQUN4QixhQUFhLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQztZQUM1QyxXQUFXLEdBQUcsWUFBWSxDQUFDLFNBQVMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBRWpELGlCQUFpQixDQUFDLGNBQWMsQ0FBQyxjQUFjLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUM7U0FDbEc7S0FDRjtJQUNELE9BQU8sQ0FBQyxVQUFVLEVBQUUsQ0FBQztJQUVyQixPQUFPLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLENBQUM7SUFDckMsSUFBSSxDQUFDLE9BQU8sRUFBRTtRQUNaLE9BQU8sQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUUvQixJQUFJLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUNqQixFQUFFLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxFQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUMsQ0FBQyxFQUN0RTtZQUNFLFVBQVUsRUFBRSxhQUFhLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN4RCxXQUFXO1NBQ1osRUFDRCxFQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBQyxDQUNqQixDQUFDO1FBRUYsS0FBSyxNQUFNLFVBQVUsSUFBSSxXQUFXLEVBQUU7WUFDcEMsRUFBRSxDQUFDLGFBQWEsQ0FBQyxVQUFVLEVBQUUsRUFBRSxFQUFFLEVBQUMsUUFBUSxFQUFFLE1BQU0sRUFBQyxDQUFDLENBQUM7U0FDdEQ7UUFFRCxNQUFNLFlBQVksR0FBRyxPQUFPLEdBQUcsYUFBYSxDQUFDO1FBQzdDLE1BQU0sZUFBZSxHQUFHLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUMvQyxJQUFJLGVBQWUsRUFBRTtZQUNuQixlQUFlLENBQUMsTUFBTSxHQUFHLFlBQVksQ0FBQztZQUN0QyxFQUFFLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsZUFBZSxDQUFDLENBQUM7U0FDM0M7UUFFRCxLQUFLLE1BQU0sVUFBVSxJQUFJLFdBQVcsRUFBRTtZQUNwQyxFQUFFLENBQUMsYUFBYSxDQUFDLFVBQVUsRUFBRSxFQUFFLEVBQUUsRUFBQyxRQUFRLEVBQUUsTUFBTSxFQUFDLENBQUMsQ0FBQztTQUN0RDtRQUNELE9BQU8sQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztLQUNuQztJQUVELElBQUksT0FBTyxFQUFFO1FBQ1gsT0FBTyxDQUFDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO1FBQ3ZDLE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQ25ELE9BQU87Z0JBQ0wsSUFBSSxFQUFFLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxjQUFjLEVBQUU7Z0JBQ3BDLE1BQU0sRUFBRSxDQUFDLENBQUMsYUFBYSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFOztvQkFDaEMsTUFBTSxLQUFLLEdBQUcsQ0FBQyxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO29CQUMvQyxJQUFJLElBQVksQ0FBQztvQkFDakIsb0JBQVEsS0FBSyxDQUFDLFNBQVMsRUFBRSwwQ0FBRSxjQUFjLHlDQUFNLEtBQUssQ0FBQyxPQUFPLEVBQUUsSUFBRTt3QkFDOUQsS0FBSyxRQUFRLENBQUM7d0JBQ2QsS0FBSyxRQUFRLENBQUM7d0JBQ2QsS0FBSyxTQUFTOzRCQUNaLElBQUksR0FBRyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7NEJBQ3ZCLE1BQU07d0JBQ1IsS0FBSyxPQUFPOzRCQUNWLElBQUksS0FBSyxDQUFDLFlBQVksRUFBRSxDQUFDLFNBQVMsRUFBRSxFQUFFO2dDQUNwQyxJQUFJLEdBQUc7OzBDQUVtQixLQUFLO3FDQUNoQyxZQUFZLEVBQUU7cUNBQ2QsU0FBUyxFQUFFO3FDQUNYLGNBQWMsRUFBRSxHQUFHLENBQUM7NkJBQ3BCO2lDQUFNO2dDQUNMLElBQUksR0FBRzs7b0JBRUgsS0FBSyxDQUFDLFlBQVksRUFBRSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUM7NkJBQ3RDOzRCQUVELE1BQU07d0JBQ1I7NEJBQ0UsSUFBSSxHQUFHO3dDQUNtQixLQUFLLENBQUMsU0FBUyxFQUFFLENBQUMsY0FBYyxFQUFFLEdBQUcsQ0FBQztxQkFDbkU7b0JBQ0QsT0FBTzt3QkFDTCxJQUFJLEVBQUUsQ0FBQyxDQUFDLGNBQWMsRUFBRTt3QkFDeEIsSUFBSTtxQkFDTCxDQUFDO2dCQUNKLENBQUMsQ0FBQzthQUNILENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztRQUNILE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQ3RCLEVBQUUsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFLEVBQUMsUUFBUSxFQUFFLE1BQU0sRUFBQyxDQUFDLEVBQzdFO1lBQ0UsVUFBVTtZQUNWLFdBQVc7U0FDWixFQUNELEVBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFDLENBQ2pCLENBQUM7UUFFRixNQUFNLE1BQU0sR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDLE9BQU8sR0FBRyxxQkFBcUIsRUFBRSxFQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUMsQ0FBQyxDQUFDO1FBRXBGLEVBQUUsQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFLE1BQU0sR0FBRyxLQUFLLEVBQUUsRUFBQyxRQUFRLEVBQUUsTUFBTSxFQUFDLENBQUMsQ0FBQztRQUM5RCxPQUFPLENBQUMsT0FBTyxDQUFDLHdCQUF3QixDQUFDLENBQUM7S0FDM0M7SUFFRCxJQUFJLENBQUMsWUFBWSxFQUFFO1FBQ2pCLE9BQU8sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDMUIsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3hCLE9BQU8sQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7S0FDOUI7QUFDSCxDQUFDO0FBalpELGtDQWlaQztBQUVELFNBQVMsTUFBTSxDQUFDLEtBQWMsRUFBRSxLQUFhO0lBQzNDLElBQUksQ0FBQyxLQUFLLEVBQUU7UUFDVixNQUFNLEtBQUssQ0FBQztLQUNiO0FBQ0gsQ0FBQztBQUVELE1BQU0sUUFBUSxHQUFHLENBQUMsSUFBWSxFQUFFLEVBQUU7SUFDaEMsSUFBSSxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQ3ZCLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxFQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUMsQ0FBQyxDQUFDLENBQUM7S0FDOUQ7SUFDRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUMsQ0FBQztBQUVGLFNBQVMsY0FBYyxDQUFDLE9BQWU7SUFDckMsS0FBSyxNQUFNLElBQUksSUFBSSxvQkFBb0IsQ0FBQyxLQUFLLEVBQUU7UUFDN0MsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLGVBQWUsRUFBRSxDQUFDO1FBQ3hELE1BQU0sV0FBVyxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztRQUNqRSxNQUFNLElBQUksR0FBRyxZQUFZLENBQUMsT0FBTyxFQUFFLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUMvRCx1Q0FBb0IsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztLQUMzRTtJQUNELElBQUksRUFBRSxHQUFHOzs7Ozs7Ozs7Ozs7OztFQWNULG9DQUFpQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7O0NBRS9CLENBQUM7SUFFQSxFQUFFLENBQUMsYUFBYSxDQUFDLE9BQU8sR0FBRyxxQkFBcUIsRUFBRSxFQUFFLEVBQUUsRUFBQyxRQUFRLEVBQUUsTUFBTSxFQUFDLENBQUMsQ0FBQztJQUUxRSxNQUFNLFlBQVksR0FBRyxPQUFPLEdBQUcsYUFBYSxDQUFDO0lBQzdDLE1BQU0sZUFBZSxHQUFHLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUMvQyxJQUFJLGVBQWUsRUFBRTtRQUNuQixlQUFlLENBQUMsTUFBTSxHQUFHLFlBQVksQ0FBQztRQUN0QyxFQUFFLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsZUFBZSxDQUFDLENBQUM7S0FDM0M7SUFFRCxFQUFFLENBQUMsYUFBYSxDQUFDLE9BQU8sR0FBRyxxQkFBcUIsRUFBRSxFQUFFLEVBQUUsRUFBQyxRQUFRLEVBQUUsTUFBTSxFQUFDLENBQUMsQ0FBQztBQUM1RSxDQUFDO0FBRUQsTUFBTSxXQUFXLEdBdUJYLEVBQUUsQ0FBQztBQUVULFNBQVMsMEJBQTBCLENBQUMsQ0FBWTtJQUM5QyxNQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ25DLE9BQU8sTUFBTSxDQUFDLE9BQU8sQ0FBQywyQkFBMkIsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUN6RCxDQUFDO0FBRUQsU0FBUyxXQUFXLENBQ2xCLGNBQXNCLEVBQ3RCLElBQVksRUFDWixXQUFtQixFQUNuQixVQUFrQixFQUNsQixVQUF1QixFQUN2QixHQUFXLEVBQ1gsTUFBYyxFQUNkLFdBQW1CO0lBRW5CLE1BQU0sU0FBUyxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFtQixDQUFDLENBQUMsZ0JBQXdCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN0SCxNQUFNLFVBQVUsR0FBRyxpQkFBaUIsVUFBVSwwQ0FBMEMsVUFBVTtTQUMvRixHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUU7UUFDUCxNQUFNLFVBQVUsR0FBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFtQixDQUFDLENBQUMsZ0JBQXdCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7UUFDbEcsTUFBTSxNQUFNLEdBQUcsMEJBQTBCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDN0MsSUFBSSxVQUFVLEtBQUssS0FBSyxFQUFFO1lBQ3hCLE9BQU8sR0FBRyxVQUFVLHdCQUF3QixDQUFDO1NBQzlDO2FBQU07WUFDTCxPQUFPLEdBQUcsVUFBVSxZQUFZLE1BQU0sU0FBUyxDQUFDO1NBQ2pEO0lBQ0gsQ0FBQyxDQUFDO1NBQ0QsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUM7SUFFaEIsSUFBSSxVQUFVLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxjQUFjLEtBQUssY0FBYyxDQUFDLENBQUM7SUFDNUUsSUFBSSxDQUFDLFVBQVUsRUFBRTtRQUNmLFVBQVUsR0FBRyxFQUFDLGNBQWMsRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFFLGtCQUFrQixFQUFFLEVBQUUsRUFBRSxlQUFlLEVBQUUsRUFBRSxFQUFDLENBQUM7UUFDMUYsV0FBVyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztLQUM5QjtJQUVELE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxVQUFVLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDOUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7UUFDeEIsSUFBSTtRQUNKLFVBQVU7UUFDVixXQUFXO1FBQ1gsVUFBVTtRQUNWLEdBQUc7UUFDSCxXQUFXO1FBQ1gsTUFBTTtRQUNOLFNBQVM7UUFDVCxXQUFXO0tBQ1osQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUNELFNBQVMsb0JBQW9CLENBQUMsY0FBc0IsRUFBRSxJQUFZLEVBQUUsV0FBbUIsRUFBRSxLQUFhO0lBQ3BHLElBQUksVUFBVSxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsY0FBYyxLQUFLLGNBQWMsQ0FBQyxDQUFDO0lBQzVFLElBQUksQ0FBQyxVQUFVLEVBQUU7UUFDZixVQUFVLEdBQUcsRUFBQyxjQUFjLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRSxrQkFBa0IsRUFBRSxFQUFFLEVBQUUsZUFBZSxFQUFFLEVBQUUsRUFBQyxDQUFDO1FBQzFGLFdBQVcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7S0FDOUI7SUFDRCxVQUFVLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDO1FBQ2pDLElBQUk7UUFDSixXQUFXO1FBQ1gsS0FBSztLQUNOLENBQUMsQ0FBQztBQUNMLENBQUM7QUFDRCxTQUFTLGlCQUFpQixDQUFDLGNBQXNCLEVBQUUsSUFBWSxFQUFFLFdBQW1CLEVBQUUsS0FBYTtJQUNqRyxJQUFJLFVBQVUsR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLGNBQWMsS0FBSyxjQUFjLENBQUMsQ0FBQztJQUM1RSxJQUFJLENBQUMsVUFBVSxFQUFFO1FBQ2YsVUFBVSxHQUFHLEVBQUMsY0FBYyxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUUsa0JBQWtCLEVBQUUsRUFBRSxFQUFFLGVBQWUsRUFBRSxFQUFFLEVBQUMsQ0FBQztRQUMxRixXQUFXLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0tBQzlCO0lBQ0QsVUFBVSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUM7UUFDOUIsSUFBSTtRQUNKLFdBQVc7UUFDWCxLQUFLO0tBQ04sQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELFNBQVMsWUFBWSxDQUFDLElBQVk7SUFDaEMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsRUFBRTtRQUNuQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUM1QixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxTQUFTLFFBQVEsQ0FBQyxFQUFVLEVBQUUsR0FBVztJQUN2QyxJQUFJLENBQUMsQ0FBQztJQUVOLE1BQU0sT0FBTyxHQUFhLEVBQUUsQ0FBQztJQUU3QixHQUFHO1FBQ0QsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDakIsSUFBSSxDQUFDLEVBQUU7WUFDTCxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ3BCO0tBQ0YsUUFBUSxDQUFDLEVBQUU7SUFDWixPQUFPLE9BQU8sQ0FBQztBQUNqQixDQUFDO0FBRUQsU0FBUyxTQUFTLENBQUMsTUFBaUIsRUFBRSxZQUFxQixJQUFJO0lBQzdELE9BQU8sTUFBTSxDQUFDLFlBQVk7U0FDdkIsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFO1FBQ1AsSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3RCLElBQUksU0FBUyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7WUFDN0MsR0FBRyxHQUFHLFNBQVMsR0FBRyxHQUFHLENBQUM7U0FDdkI7UUFDRCxPQUFPLEdBQUcsQ0FBQztJQUNiLENBQUMsQ0FBQztTQUNELElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNoQixDQUFDIn0=