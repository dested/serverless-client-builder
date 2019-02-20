"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ejs = require("ejs");
const fs = require("fs");
const prettier = require("prettier");
const ts_simple_ast_1 = require("ts-simple-ast");
const manageSymbols_1 = require("./manageSymbols");
function processFile(apiPath, outputFile, legacyUrl, microService) {
    const extendedUrl = !legacyUrl;
    const tsConfigFilePath = apiPath + 'tsconfig.json';
    const project = new ts_simple_ast_1.default({
        tsConfigFilePath,
    });
    const symbolManager = new manageSymbols_1.ManageSymbols();
    const controllerDataItems = [];
    for (const sourceFile of project.getSourceFiles()) {
        for (const classDeclaration of sourceFile.getDescendantsOfKind(ts_simple_ast_1.SyntaxKind.ClassDeclaration)) {
            if (classDeclaration.getDecorators().length > 0 &&
                classDeclaration.getDecorators()[0].getName() === 'controller') {
                const controllerName = classDeclaration
                    .getDecorators()[0]
                    .getArguments()[0]
                    .getText();
                const controllerData = {
                    name: eval(controllerName),
                    methods: [],
                    websockets: [],
                    websocketEvents: [],
                    events: [],
                };
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
                                options,
                                declaration,
                            });
                        }
                        if (decorator.getName() === 'event') {
                            const methodName = declaration.getName();
                            const rate = eval(decorator.getArguments()[0].getText());
                            const data = controllerData.events.find(a => a.name === methodName);
                            if (data) {
                                data.rate.push(rate);
                            }
                            else {
                                controllerData.events.push({
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
    const disclaimer = '# This file was generated by https://github.com/dested/serverless-client-builder\r\n';
    const header = fs.readFileSync(apiPath + 'serverless-header.yml', { encoding: 'utf8' });
    const websocketHeader = fs.readFileSync(apiPath + 'serverless-websocket-header.yml', { encoding: 'utf8' });
    let mainServerless = disclaimer + header;
    for (const controllerDataItem of controllerDataItems) {
        let controllerServerless = disclaimer +
            (controllerDataItem.websockets.length > 0 ? websocketHeader : header)
                .replace(/service: (.+)\r*\n/, (a, b) => `service: ${b}-${controllerDataItem.name}\r\n`)
                .replace("basePath: ''", `basePath: '${controllerDataItem.name}'`);
        for (const method of controllerDataItem.methods) {
            mainServerless += `
  ${controllerDataItem.name}_${method.name}:
    handler: handler.${controllerDataItem.name}_${method.name}
${method.options.map(a => `    ${a.key}: ${a.value}`).join('\r\n')}    events:
      - http:
          path: ${extendedUrl ? `${controllerDataItem.name}/` : ''}${method.path}
          method: ${method.method}
          cors: true`;
            controllerServerless += `
  ${method.name}:
    handler: handler.${controllerDataItem.name}_${method.name}
${method.options.map(a => `    ${a.key}: ${a.value}`).join('\r\n')}    events:
      - http:
          path: /${method.path}
          method: ${method.method}
          cors: true`;
        }
        for (const event of controllerDataItem.events) {
            mainServerless += `
  ${controllerDataItem.name}_${event.name}:
    handler: handler.${controllerDataItem.name}_${event.name}
    events:
${event.rate.map(a => `      - schedule: ${a}`).join('\r\n')}`;
            controllerServerless += `
  ${event.name}:
    handler: handler.${controllerDataItem.name}_${event.name}
    events:
${event.rate.map(a => `      - schedule: ${a}`).join('\r\n')}`;
        }
        for (const websocket of controllerDataItem.websockets) {
            mainServerless += `
  ${controllerDataItem.name}_${websocket.name}:
    handler: handler.${controllerDataItem.name}_${websocket.name}
    events:
${websocket.routeKey.map(a => `      - websocket: ${a}`).join('\r\n')}`;
            controllerServerless += `
  ${websocket.name}:
    handler: handler.${controllerDataItem.name}_${websocket.name}
    events:
${websocket.routeKey.map(a => `      - websocket: ${a}`).join('\r\n')}`;
        }
        if (microService) {
            fs.writeFileSync(`${apiPath}controllers/${kebabToCamel(controllerDataItem.name)}Controller/serverless.yml`, controllerServerless, { encoding: 'utf8' });
        }
    }
    fs.writeFileSync(apiPath + 'serverless.yml', mainServerless, { encoding: 'utf8' });
    for (const controllerDataItem of controllerDataItems) {
        for (const method of controllerDataItem.methods) {
            const funcName = method.name;
            const funcNode = method.declaration;
            assert(funcNode.getParameters().length === 1, 'The export must only have one parameter');
            const eventArg = funcNode.getParameters()[0].getType();
            assert(eventArg.getSymbol().getName() === 'RequestEvent', 'RequestEvent argument must be a generic event class');
            const typeArgument = eventArg.getTypeArguments()[0];
            let requestName;
            if (typeArgument.getText() !== 'void') {
                symbolManager.addSymbol(typeArgument);
                requestName = typeArgument.getSymbol().getName();
            }
            else {
                requestName = 'void';
            }
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
            symbolManager.addSymbol(httpResponseTypeArgument);
            addFunction(method.controllerName, funcName, requestName, httpResponseTypeArgument.getSymbol().getName(), errorTypes, '/' + (extendedUrl ? `${controllerDataItem.name}/` : '') + method.path, method.method);
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
            if (typeArgument.getText() !== 'void') {
                symbolManager.addSymbol(typeArgument);
                requestName = typeArgument.getSymbol().getName();
            }
            else {
                requestName = 'void';
            }
            addWebsocketFunction(websocket.controllerName, funcName, requestName, websocket.routeKey[0]);
        }
        for (const websocketEvent of controllerDataItem.websocketEvents) {
            const funcName = websocketEvent.name;
            const funcNode = websocketEvent.declaration;
            assert(funcNode.getParameters().length === 3, 'The export must only have three parameters');
            const eventArg = funcNode.getParameters()[2].getType();
            assert(eventArg.getSymbol().getName() === 'WebSocketEvent', 'WebSocketEvent argument must be a generic event class');
            const typeArgument = eventArg.getTypeArguments()[1];
            let requestName;
            if (typeArgument.getText() !== 'void') {
                symbolManager.addSymbol(typeArgument);
                requestName = typeArgument.getSymbol().getName();
            }
            else {
                requestName = 'void';
            }
            addWebsocketEvent(websocketEvent.controllerName, funcName, requestName, websocketEvent.routeKey);
        }
    }
    let js = ejs.render(fs.readFileSync(require.resolve('./template.ejs'), { encoding: 'utf8' }), {
        interfaces: symbolManager.symbols.map(a => getSource(a)),
        controllers,
    }, { escape: e => e });
    fs.writeFileSync(outputFile, js, { encoding: 'utf8' });
    const prettierFile = apiPath + '.prettierrc';
    const prettierOptions = readJson(prettierFile);
    if (prettierOptions) {
        js = prettier.format(js, prettierOptions);
    }
    // console.log(js);
    fs.writeFileSync(outputFile, js, { encoding: 'utf8' });
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
const controllers = [];
function getSourceWithoutStatusCode(a) {
    const source = getSource(a, false);
    return source.replace(/statusCode\s*:\s*\d+,?;?/g, '');
}
function addFunction(controllerName, name, requestType, returnType, errorTypes, url, method) {
    const errorCode = errorTypes.map(a => a.members.get('statusCode').valueDeclaration.type.literal.text);
    const handleType = `{200?:(result:${returnType})=>TPromise,500:(result:string)=>void,${errorTypes
        .map(a => {
        const statusCode = a.members.get('statusCode').valueDeclaration.type.literal.text;
        const source = getSourceWithoutStatusCode(a);
        return `${statusCode}:(result:${source})=>void`;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3Byb2Nlc3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSwyQkFBMkI7QUFDM0IseUJBQXlCO0FBQ3pCLHFDQUFxQztBQUNyQyxpREFBeUU7QUFFekUsbURBQThDO0FBRTlDLFNBQWdCLFdBQVcsQ0FBQyxPQUFlLEVBQUUsVUFBa0IsRUFBRSxTQUFpQixFQUFFLFlBQW9CO0lBQ3RHLE1BQU0sV0FBVyxHQUFHLENBQUMsU0FBUyxDQUFDO0lBRS9CLE1BQU0sZ0JBQWdCLEdBQUcsT0FBTyxHQUFHLGVBQWUsQ0FBQztJQUVuRCxNQUFNLE9BQU8sR0FBRyxJQUFJLHVCQUFPLENBQUM7UUFDMUIsZ0JBQWdCO0tBQ2pCLENBQUMsQ0FBQztJQUVILE1BQU0sYUFBYSxHQUFHLElBQUksNkJBQWEsRUFBRSxDQUFDO0lBQzFDLE1BQU0sbUJBQW1CLEdBQXFCLEVBQUUsQ0FBQztJQUNqRCxLQUFLLE1BQU0sVUFBVSxJQUFJLE9BQU8sQ0FBQyxjQUFjLEVBQUUsRUFBRTtRQUNqRCxLQUFLLE1BQU0sZ0JBQWdCLElBQUksVUFBVSxDQUFDLG9CQUFvQixDQUFDLDBCQUFVLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtZQUMzRixJQUNFLGdCQUFnQixDQUFDLGFBQWEsRUFBRSxDQUFDLE1BQU0sR0FBRyxDQUFDO2dCQUMzQyxnQkFBZ0IsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsS0FBSyxZQUFZLEVBQzlEO2dCQUNBLE1BQU0sY0FBYyxHQUFHLGdCQUFnQjtxQkFDcEMsYUFBYSxFQUFFLENBQUMsQ0FBQyxDQUFDO3FCQUNsQixZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7cUJBQ2pCLE9BQU8sRUFBRSxDQUFDO2dCQUViLE1BQU0sY0FBYyxHQUFtQjtvQkFDckMsSUFBSSxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUM7b0JBQzFCLE9BQU8sRUFBRSxFQUFFO29C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