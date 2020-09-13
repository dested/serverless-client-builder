"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ejs = require("ejs");
const fs = require("fs");
const prettier = require("prettier");
const ts_simple_ast_1 = require("ts-simple-ast");
const manageSymbols_1 = require("./manageSymbols");
const validationTester_1 = require("./validationTester");
const requestSymbolManager = new manageSymbols_1.ManageSymbols();
function processFile(apiPath, outputFiles, noValidation, noYaml, templateV2, openApi) {
    var _a, _b;
    const templateVersion = templateV2 ? './templateV2.ejs' : './template.ejs';
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
                            assert(!!decorator.getArguments()[2], `Missing options arg ${name}`);
                            const text = decorator.getArguments()[2].getText();
                            const requestOptions = eval('(' + text + ')');
                            assert(!!requestOptions, `Missing options arg ${name}`);
                            assert(Array.isArray(requestOptions.statusCodes), `Missing status code arg ${name}`);
                            for (const key of Object.keys(requestOptions)) {
                                options.push({ key, value: requestOptions[key] });
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
${websocket.routeKey
                    .map(a => `      - websocket: 
         route: ${a}`)
                    .join('\r\n')}`;
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
            assert(funcNode.getParameters().length >= 1, 'The export must have a request model parameter');
            const eventArg = funcNode.getParameters()[0].getType();
            const typeArgument = eventArg;
            let requestName;
            symbolManager.addSymbol(typeArgument, true);
            requestName = typeArgument.getSymbol().getName();
            requestSymbolManager.addSymbol(typeArgument, true);
            const returnType = funcNode.getReturnType();
            assert(returnType.getSymbol().getName() === 'Promise', 'Return type must must be a promise');
            const returnTypeArgument = returnType.getTypeArguments()[0];
            const httpResponseTypeArgument = returnTypeArgument;
            symbolManager.addSymbol(httpResponseTypeArgument, true);
            addFunction(method.controllerName, funcName, requestName, httpResponseTypeArgument.getSymbol().getName(), method.options.find(a => a.key === 'statusCodes').value, `/${controllerDataItem.route || controllerDataItem.name}/${method.path}`, method.method, (_a = method.options.find(a => a.key === 'description')) === null || _a === void 0 ? void 0 : _a.value, !!((_b = method.options.find(a => a.key === 'auth')) === null || _b === void 0 ? void 0 : _b.value));
        }
        for (const websocket of controllerDataItem.websockets) {
            if (websocket.routeKey.find(a => a[0] === '$')) {
                continue;
            }
            const funcName = websocket.name;
            const funcNode = websocket.declaration;
            assert(funcNode.getParameters().length === 1, `${funcName} The export must only have one parameter`);
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
            let found = false;
            for (const parameter of funcNode.getParameters()) {
                const eventArg = parameter.getType();
                if (eventArg.getSymbol().getName() === 'WebSocketResponse') {
                    const typeArgument = eventArg.getTypeArguments()[0];
                    let requestName;
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
    console.profileEnd();
    console.timeEnd('parse controllers');
    if (!openApi) {
        console.time('write template');
        let js = ejs.render(fs.readFileSync(require.resolve(templateVersion), { encoding: 'utf8' }), {
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
function addFunction(controllerName, name, requestType, returnType, errorTypes, url, method, description, auth) {
    if (!errorTypes.find(a => a === 401))
        errorTypes.push(401);
    const handleType = `{200?:(result:${returnType})=>void,500?:(result:string)=>void,${errorTypes
        .map(a => {
        const statusCode = a;
        if (statusCode === 401) {
            return `${statusCode}?:(error:string)=>void`;
        }
        else {
            return `${statusCode}:(result:{error:string})=>void`;
        }
    })
        .join(',')}}`;
    let controller = controllers.find(a => a.controllerName === controllerName);
    if (!controller) {
        controller = { controllerName, functions: [], websocketFunctions: [], websocketEvents: [] };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3Byb2Nlc3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFFQSwyQkFBMkI7QUFDM0IseUJBQXlCO0FBQ3pCLHFDQUFxQztBQUNyQyxpREFBaUc7QUFFakcsbURBQThDO0FBQzlDLHlEQUEyRTtBQUUzRSxNQUFNLG9CQUFvQixHQUFHLElBQUksNkJBQWEsRUFBRSxDQUFDO0FBRWpELFNBQWdCLFdBQVcsQ0FDekIsT0FBZSxFQUNmLFdBQXFCLEVBQ3JCLFlBQXFCLEVBQ3JCLE1BQWUsRUFDZixVQUFtQixFQUNuQixPQUFlOztJQUVmLE1BQU0sZUFBZSxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLGdCQUFnQixDQUFDO0lBRTNFLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDdEIsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLEdBQUcsZUFBZSxDQUFDO0lBRW5ELE1BQU0sT0FBTyxHQUFHLElBQUksdUJBQU8sQ0FBQztRQUMxQixnQkFBZ0I7S0FDakIsQ0FBQyxDQUFDO0lBQ0gsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUV6QixPQUFPLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFFaEMsTUFBTSxhQUFhLEdBQUcsSUFBSSw2QkFBYSxFQUFFLENBQUM7SUFDMUMsTUFBTSxtQkFBbUIsR0FBcUIsRUFBRSxDQUFDO0lBQ2pELEtBQUssTUFBTSxVQUFVLElBQUksT0FBTyxDQUFDLGNBQWMsRUFBRSxFQUFFO1FBQ2pELEtBQUssTUFBTSxnQkFBZ0IsSUFBSSxVQUFVLENBQUMsb0JBQW9CLENBQUMsMEJBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO1lBQzNGLE1BQU0sY0FBYyxHQUFHLGdCQUFnQixDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRTNELElBQUksY0FBYyxJ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