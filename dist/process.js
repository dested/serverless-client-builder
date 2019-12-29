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
    var _a, _b;
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
            addFunction(method.controllerName, funcName, requestName, httpResponseTypeArgument.getSymbol().getName(), errorTypes, `/${controllerDataItem.route || controllerDataItem.name}/${method.path}`, method.method, (_a = method.options.find(a => a.key === 'description')) === null || _a === void 0 ? void 0 : _a.value, !!((_b = method.options.find(a => a.key === 'auth')) === null || _b === void 0 ? void 0 : _b.value));
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
        const interfaces = symbolManager.symbolTypes
            .filter(a => !a.isUnion())
            .map(a => {
            return {
                name: (a.getSymbol() || a.getAliasSymbol()).getEscapedName(),
                fields: a.getProperties().map(topP => {
                    function getType(p) {
                        var _a, _b, _c;
                        const typeV = p.getDeclarations()[0].getType();
                        let type;
                        if (typeV.isUnion() && typeV.getText() !== 'boolean') {
                            type = `
          enum:`;
                            for (const unionType of typeV.getUnionTypes()) {
                                type += `
            - ${unionType.getText()}`;
                            }
                        }
                        else {
                            switch ((_b = (_a = typeV.getSymbol()) === null || _a === void 0 ? void 0 : _a.getEscapedName(), (_b !== null && _b !== void 0 ? _b : typeV.getText()))) {
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
                                    }
                                    else {
                                        type = `type: array
          items:
            type: ${typeV.getArrayType().getText()}`;
                                    }
                                    break;
                                default:
                                    type = `
          $ref: '#/components/schemas/${(_c = typeV.getSymbol(), (_c !== null && _c !== void 0 ? _c : typeV.getAliasSymbol())).getEscapedName()}'`;
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
function addFunction(controllerName, name, requestType, returnType, errorTypes, url, method, description, auth) {
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
        auth,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3Byb2Nlc3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSwyQkFBMkI7QUFDM0IseUJBQXlCO0FBQ3pCLHFDQUFxQztBQUNyQyxpREFBaUc7QUFFakcsbURBQThDO0FBQzlDLHlEQUEyRTtBQUUzRSxNQUFNLG9CQUFvQixHQUFHLElBQUksNkJBQWEsRUFBRSxDQUFDO0FBRWpELFNBQWdCLFdBQVcsQ0FDekIsT0FBZSxFQUNmLFdBQXFCLEVBQ3JCLFlBQXFCLEVBQ3JCLE1BQWUsRUFDZixPQUFlOztJQUVmLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDdEIsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLEdBQUcsZUFBZSxDQUFDO0lBRW5ELE1BQU0sT0FBTyxHQUFHLElBQUksdUJBQU8sQ0FBQztRQUMxQixnQkFBZ0I7S0FDakIsQ0FBQyxDQUFDO0lBQ0gsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUV6QixPQUFPLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFFaEMsTUFBTSxhQUFhLEdBQUcsSUFBSSw2QkFBYSxFQUFFLENBQUM7SUFDMUMsTUFBTSxtQkFBbUIsR0FBcUIsRUFBRSxDQUFDO0lBQ2pELEtBQUssTUFBTSxVQUFVLElBQUksT0FBTyxDQUFDLGNBQWMsRUFBRSxFQUFFO1FBQ2pELEtBQUssTUFBTSxnQkFBZ0IsSUFBSSxVQUFVLENBQUMsb0JBQW9CLENBQUMsMEJBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO1lBQzNGLE1BQU0sY0FBYyxHQUFHLGdCQUFnQixDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRTNELElBQUksY0FBYyxJQUFJLGNBQWMsQ0FBQyxPQUFPLEVBQUUsS0FBSyxZQUFZLEVBQUU7Z0JBQy9ELE1BQU0sY0FBYyxHQUFHLGNBQWMsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxD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