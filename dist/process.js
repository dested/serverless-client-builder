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
    const websocketHeader = fs.existsSync(apiPath + 'serverless-websocket-header.yml')
        ? fs.readFileSync(apiPath + 'serverless-websocket-header.yml', { encoding: 'utf8' })
        : 'error';
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
${method.options.map(a => `    ${a.key}: ${a.value}`).join('\r\n') + '\r\n'}    events:
      - http:
          path: ${extendedUrl ? `${controllerDataItem.name}/` : ''}${method.path}
          method: ${method.method}
          cors: true`;
            controllerServerless += `
  ${method.name}:
    handler: handler.${controllerDataItem.name}_${method.name}
${method.options.map(a => `    ${a.key}: ${a.value}`).join('\r\n') + '\r\n'}    events:
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
${event.rate.map(a => `      - schedule: ${a}`).join('\r\n') + '\r\n'}`;
            controllerServerless += `
  ${event.name}:
    handler: handler.${controllerDataItem.name}_${event.name}
    events:
${event.rate.map(a => `      - schedule: ${a}`).join('\r\n') + '\r\n'}`;
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
            assert(eventArg.getSymbol().getName() === 'WebSocketResponse', 'WebSocketEvent argument must be a generic event class');
            const typeArgument = eventArg.getTypeArguments()[0];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3Byb2Nlc3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSwyQkFBMkI7QUFDM0IseUJBQXlCO0FBQ3pCLHFDQUFxQztBQUNyQyxpREFBeUU7QUFFekUsbURBQThDO0FBRTlDLFNBQWdCLFdBQVcsQ0FBQyxPQUFlLEVBQUUsVUFBa0IsRUFBRSxTQUFpQixFQUFFLFlBQW9CO0lBQ3RHLE1BQU0sV0FBVyxHQUFHLENBQUMsU0FBUyxDQUFDO0lBRS9CLE1BQU0sZ0JBQWdCLEdBQUcsT0FBTyxHQUFHLGVBQWUsQ0FBQztJQUVuRCxNQUFNLE9BQU8sR0FBRyxJQUFJLHVCQUFPLENBQUM7UUFDMUIsZ0JBQWdCO0tBQ2pCLENBQUMsQ0FBQztJQUVILE1BQU0sYUFBYSxHQUFHLElBQUksNkJBQWEsRUFBRSxDQUFDO0lBQzFDLE1BQU0sbUJBQW1CLEdBQXFCLEVBQUUsQ0FBQztJQUNqRCxLQUFLLE1BQU0sVUFBVSxJQUFJLE9BQU8sQ0FBQyxjQUFjLEVBQUUsRUFBRTtRQUNqRCxLQUFLLE1BQU0sZ0JBQWdCLElBQUksVUFBVSxDQUFDLG9CQUFvQixDQUFDLDBCQUFVLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtZQUMzRixJQUNFLGdCQUFnQixDQUFDLGFBQWEsRUFBRSxDQUFDLE1BQU0sR0FBRyxDQUFDO2dCQUMzQyxnQkFBZ0IsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsS0FBSyxZQUFZLEVBQzlEO2dCQUNBLE1BQU0sY0FBYyxHQUFHLGdCQUFnQjtxQkFDcEMsYUFBYSxFQUFFLENBQUMsQ0FBQyxDQUFDO3FCQUNsQixZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7cUJBQ2pCLE9BQU8sRUFBRSxDQUFDO2dCQUViLE1BQU0sY0FBYyxHQUFtQjtvQkFDckMsSUFBSSxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUM7b0JBQzFCLE9BQU8sRUFBRSxFQUFFO29CQUNYLFVBQVUsRUFBRSxFQUFFO29CQUNkLGVBQWUsRUFBRSxFQUFFO29CQUNuQixNQUFNLEVBQUUsRUFBRTtpQkFDWCxDQUFDO2dCQUVGLG1CQUFtQixDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztnQkFDekMsS0FBSyxNQUFNLFdBQVcsSUFBSSxnQkFBZ0IsQ0FBQyxVQUFVLEVBQUUsRUFBRTtvQkFDdkQsS0FBSyxNQUFNLFNBQVMsSUFBSSxXQUFXLENBQUMsYUFBYSxFQUFFLEVBQUU7d0JBQ25ELElBQUksU0FBUyxDQUFDLE9BQU8sRUFBRSxLQUFLLFNBQVMsRUFBRTs0QkFDckMsTUFBTSxJQUFJLEdBQUcsV0FBVyxDQUFDLE9BQU8sRUFBRSxDQUFDOzRCQUNuQyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7NEJBQzNELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQzs0QkFDekQsTUFBTSxPQUFPLEdBQW1DLEVBQUUsQ0FBQzs0QkFDbkQsSUFBSSxTQUFTLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUU7Z0NBQy9CLE1BQU0sSUFBSSxHQUFHLFNBQVMsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQ0FDbkQsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUM7Z0NBQzlDLElBQUksY0FBYyxFQUFFO29DQUNsQixLQUFLLE1BQU0sR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLEVBQUU7d0NBQzdDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLGNBQWMsQ0FBQyxHQUFHLENBQUMsRUFBQyxDQUFDLENBQUM7cUNBQ2pEO2lDQUNGOzZCQUNGOzRCQUNELGNBQWMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO2dDQUMxQixjQUFjLEVBQUUsY0FBYyxDQUFDLElBQUk7Z0NBQ25DLElBQUk7Z0NBQ0osTUFBTTtnQ0FDTixJQUFJO2dDQUNKLE9BQU87Z0NBQ1AsV0FBVzs2QkFDWixDQUFDLENBQUM7eUJBQ0o7d0JBQ0QsSUFBSSxTQUFTLENBQUMsT0FBTyxFQUFFLEtBQUssT0FBTyxFQUFFOzRCQUNuQyxNQUFNLFVBQVUsR0FBRyxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUM7NEJBQ3pDLE1BQU0sSUFBSSxHQUFXLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQzs0QkFFakUsTUFBTSxJQUFJLEdBQUcsY0FBYyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLFVBQVUsQ0FBQyxDQUFDOzRCQUNwRSxJQUFJLElBQUksRUFBRTtnQ0FDUixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzs2QkFDdEI7aUNBQU07Z0NBQ0wsY0FBYyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7b0NBQ3pCLGNBQWMsRUFBRSxjQUFjLENBQUMsSUFBSTtvQ0FDbkMsSUFBSSxFQUFFLFVBQVU7b0NBQ2hCLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQztvQ0FDWixXQUFXO2lDQUNaLENBQUMsQ0FBQzs2QkFDSjt5QkFDRjt3QkFDRCxJQUFJLFNBQVMsQ0FBQyxPQUFPLEVBQUUsS0FBSyxrQkFBa0IsRUFBRTs0QkFDOUMsTUFBTSxVQUFVLEdBQUcsV0FBVyxDQUFDLE9BQU8sRUFBRSxDQUFDOzRCQUN6QyxNQUFNLFFBQVEsR0FBVyxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7NEJBQ3JFLE1BQU0sSUFBSSxHQUFHLGNBQWMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxVQUFVLENBQUMsQ0FBQzs0QkFDeEUsSUFBSSxJQUFJLEVBQUU7Z0NBQ1IsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7NkJBQzlCO2lDQUFNO2dDQUNMLGNBQWMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDO29DQUM3QixjQUFjLEVBQUUsY0FBYyxDQUFDLElBQUk7b0NBQ25DLElBQUksRUFBRSxVQUFVO29DQUNoQixRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUM7b0NBQ3BCLFdBQVc7aUNBQ1osQ0FBQyxDQUFDOzZCQUNKO3lCQUNGO3dCQUNELElBQUksU0FBUyxDQUFDLE9BQU8sRUFBRSxLQUFLLGdCQUFnQixFQUFFOzRCQUM1QyxNQUFNLFVBQVUsR0FBRyxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUM7NEJBQ3pDLE1BQU0sUUFBUSxHQUFXLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQzs0QkFDckUsY0FBYyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUM7Z0NBQ2xDLGNBQWMsRUFBRSxjQUFjLENBQUMsSUFBSTtnQ0FDbkMsSUFBSSxFQUFFLFVBQVU7Z0NBQ2hCLFFBQVE7Z0NBQ1IsV0FBVzs2QkFDWixDQUFDLENBQUM7eUJBQ0o7cUJBQ0Y7aUJBQ0Y7YUFDRjtTQUNGO0tBQ0Y7SUFFRCxNQUFNLFVBQVUsR0FBRyxzRkFBc0YsQ0FBQztJQUMxRyxNQUFNLE1BQU0sR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDLE9BQU8sR0FBRyx1QkFBdUIsRUFBRSxFQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUMsQ0FBQyxDQUFDO0lBQ3RGLE1BQU0sZUFBZSxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxHQUFHLGlDQUFpQyxDQUFDO1FBQ2hGLENBQUMsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLE9BQU8sR0FBRyxpQ0FBaUMsRUFBRSxFQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUMsQ0FBQztRQUNsRixDQUFDLENBQUMsT0FBTyxDQUFDO0lBRVosSUFBSSxjQUFjLEdBQUcsVUFBVSxHQUFHLE1BQU0sQ0FBQztJQUN6QyxLQUFLLE1BQU0sa0JBQWtCLElBQUksbUJBQW1CLEVBQUU7UUFDcEQsSUFBSSxvQkFBb0IsR0FDdEIsVUFBVTtZQUNWLENBQUMsa0JBQWtCLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO2lCQUNsRSxPQUFPLENBQUMsb0JBQW9CLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxrQkFBa0IsQ0FBQyxJQUFJLE1BQU0sQ0FBQztpQkFDdkYsT0FBTyxDQUFDLGNBQWMsRUFBRSxjQUFjLGtCQUFrQixDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7UUFFdkUsS0FBSyxNQUFNLE1BQU0sSUFBSSxrQkFBa0IsQ0FBQyxPQUFPLEVBQUU7WUFDL0MsY0FBYyxJQUFJO0lBQ3BCLGtCQUFrQixDQUFDLElBQUksSUFBSSxNQUFNLENBQUMsSUFBSTt1QkFDbkIsa0JBQWtCLENBQUMsSUFBSSxJQUFJLE1BQU0sQ0FBQyxJQUFJO0VBQzNELE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNOztrQkFFekQsV0FBVyxDQUFDLENBQUMsQ0FBQyxHQUFHLGtCQUFrQixDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsTUFBTSxDQUFDLElBQUk7b0JBQzVELE1BQU0sQ0FBQyxNQUFNO3FCQUNaLENBQUM7WUFFaEIsb0JBQW9CLElBQUk7SUFDMUIsTUFBTSxDQUFDLElBQUk7dUJBQ1Esa0JBQWtCLENBQUMsSUFBSSxJQUFJLE1BQU0sQ0FBQyxJQUFJO0VBQzNELE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNOzttQkFFeEQsTUFBTSxDQUFDLElBQUk7b0JBQ1YsTUFBTSxDQUFDLE1BQU07cUJBQ1osQ0FBQztTQUNqQjtRQUVELEtBQUssTUFBTSxLQUFLLElBQUksa0JBQWtCLENBQUMsTUFBTSxFQUFFO1lBQzdDLGNBQWMsSUFBSTtJQUNwQixrQkFBa0IsQ0FBQyxJQUFJLElBQUksS0FBSyxDQUFDLElBQUk7dUJBQ2xCLGtCQUFrQixDQUFDLElBQUksSUFBSSxLQUFLLENBQUMsSUFBSTs7RUFFMUQsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUM7WUFFbEUsb0JBQW9CLElBQUk7SUFDMUIsS0FBSyxDQUFDLElBQUk7dUJBQ1Msa0JBQWtCLENBQUMsSUFBSSxJQUFJLEtBQUssQ0FBQyxJQUFJOztFQUUxRCxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLHFCQUFxQixDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQztTQUNuRTtRQUVELEtBQUssTUFBTSxTQUFTLElBQUksa0JBQWtCLENBQUMsVUFBVSxFQUFFO1lBQ3JELGNBQWMsSUFBSTtJQUNwQixrQkFBa0IsQ0FBQyxJQUFJLElBQUksU0FBUyxDQUFDLElBQUk7dUJBQ3RCLGtCQUFrQixDQUFDLElBQUksSUFBSSxTQUFTLENBQUMsSUFBSTs7RUFFOUQsU0FBUyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxzQkFBc0IsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUNsRSxvQkFBb0IsSUFBSTtJQUMxQixTQUFTLENBQUMsSUFBSTt1QkFDSyxrQkFBa0IsQ0FBQyxJQUFJLElBQUksU0FBUyxDQUFDLElBQUk7O0VBRTlELFNBQVMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsc0JBQXNCLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7U0FDbkU7UUFFRCxJQUFJLFlBQVksRUFBRTtZQUNoQixFQUFFLENBQUMsYUFBYSxDQUNkLEdBQUcsT0FBTyxlQUFlLFlBQVksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsMkJBQTJCLEVBQ3pGLG9CQUFvQixFQUNwQixFQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUMsQ0FDbkIsQ0FBQztTQUNIO0tBQ0Y7SUFDRCxFQUFFLENBQUMsYUFBYSxDQUFDLE9BQU8sR0FBRyxnQkFBZ0IsRUFBRSxjQUFjLEVBQUUsRUFBQyxRQUFRLEVBQUUsTUFBTSxFQUFDLENBQUMsQ0FBQztJQUVqRixLQUFLLE1BQU0sa0JBQWtCLElBQUksbUJBQW1CLEVBQUU7UUFDcEQsS0FBSyxNQUFNLE1BQU0sSUFBSSxrQkFBa0IsQ0FBQyxPQUFPLEVBQUU7WUFDL0MsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQztZQUU3QixNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDO1lBRXBDLE1BQU0sQ0FBQyxRQUFRLENBQUMsYUFBYSxFQUFFLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSx5Q0FBeUMsQ0FBQyxDQUFDO1lBQ3pGLE1BQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN2RCxNQUFNLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDLE9BQU8sRUFBRSxLQUFLLGNBQWMsRUFBRSxxREFBcUQsQ0FBQyxDQUFDO1lBQ2pILE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3BELElBQUksV0FBbUIsQ0FBQztZQUN4QixJQUFJLFlBQVksQ0FBQyxPQUFPLEVBQUUsS0FBSyxNQUFNLEVBQUU7Z0JBQ3JDLGFBQWEsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLENBQUM7Z0JBQ3RDLFdBQVcsR0FBRyxZQUFZLENBQUMsU0FBUyxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUM7YUFDbEQ7aUJBQU07Z0JBQ0wsV0FBVyxHQUFHLE1BQU0sQ0FBQzthQUN0QjtZQUVELE1BQU0sVUFBVSxHQUFHLFFBQVEsQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUM1QyxNQUFNLENBQUMsVUFBVSxDQUFDLFNBQVMsRUFBRSxDQUFDLE9BQU8sRUFBRSxLQUFLLFNBQVMsRUFBRSxvQ0FBb0MsQ0FBQyxDQUFDO1lBQzdGLE1BQU0sa0JBQWtCLEdBQUcsVUFBVSxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUQsTUFBTSxDQUNKLGtCQUFrQixDQUFDLFNBQVMsRUFBRSxDQUFDLE9BQU8sRUFBRSxLQUFLLGNBQWMsRUFDM0Qsb0RBQW9ELENBQ3JELENBQUM7WUFDRixNQUFNLHdCQUF3QixHQUFHLGtCQUFrQixDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDMUUsTUFBTSx5QkFBeUIsR0FBRyxrQkFBa0IsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRTNFLE1BQU0sVUFBVSxHQUFnQixFQUFFLENBQUM7WUFFbkMsSUFBSyx5QkFBeUIsQ0FBQyxZQUFvQixDQUFDLGFBQWEsS0FBSyxXQUFXLEVBQUU7Z0JBQ2pGLElBQUkseUJBQXlCLENBQUMsYUFBYSxFQUFFLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtvQkFDMUQsVUFBVSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQztpQkFDdkY7cUJBQU07b0JBQ0wsS0FBSyxNQUFNLFNBQVMsSUFBSSx5QkFBeUIsQ0FBQyxhQUFhLEVBQUUsRUFBRTt3QkFDakUsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUM7cUJBQ3JEO2lCQUNGO2FBQ0Y7WUFDRCxhQUFhLENBQUMsU0FBUyxDQUFDLHdCQUF3QixDQUFDLENBQUM7WUFDbEQsV0FBVyxDQUNULE1BQU0sQ0FBQyxjQUFjLEVBQ3JCLFFBQVEsRUFDUixXQUFXLEVBQ1gsd0JBQXdCLENBQUMsU0FBUyxFQUFFLENBQUMsT0FBTyxFQUFFLEVBQzlDLFVBQVUsRUFDVixHQUFHLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLEdBQUcsa0JBQWtCLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxJQUFJLEVBQ3RFLE1BQU0sQ0FBQyxNQUFNLENBQ2QsQ0FBQztTQUNIO1FBQ0QsS0FBSyxNQUFNLFNBQVMsSUFBSSxrQkFBa0IsQ0FBQyxVQUFVLEVBQUU7WUFDckQsSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsRUFBRTtnQkFDOUMsU0FBUzthQUNWO1lBRUQsTUFBTSxRQUFRLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQztZQUNoQyxNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsV0FBVyxDQUFDO1lBRXZDLE1BQU0sQ0FBQyxRQUFRLENBQUMsYUFBYSxFQUFFLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSx5Q0FBeUMsQ0FBQyxDQUFDO1lBQ3pGLE1BQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN2RCxNQUFNLENBQ0osUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDLE9BQU8sRUFBRSxLQUFLLHVCQUF1QixFQUMxRCw4REFBOEQsQ0FDL0QsQ0FBQztZQUNGLE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3BELElBQUksV0FBbUIsQ0FBQztZQUN4QixJQUFJLFlBQVksQ0FBQyxPQUFPLEVBQUUsS0FBSyxNQUFNLEVBQUU7Z0JBQ3JDLGFBQWEsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLENBQUM7Z0JBQ3RDLFdBQVcsR0FBRyxZQUFZLENBQUMsU0FBUyxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUM7YUFDbEQ7aUJBQU07Z0JBQ0wsV0FBVyxHQUFHLE1BQU0sQ0FBQzthQUN0QjtZQUNELG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDOUY7UUFDRCxLQUFLLE1BQU0sY0FBYyxJQUFJLGtCQUFrQixDQUFDLGVBQWUsRUFBRTtZQUMvRCxNQUFNLFFBQVEsR0FBRyxjQUFjLENBQUMsSUFBSSxDQUFDO1lBQ3JDLE1BQU0sUUFBUSxHQUFHLGNBQWMsQ0FBQyxXQUFXLENBQUM7WUFFNUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLDRDQUE0QyxDQUFDLENBQUM7WUFDNUYsTUFBTSxRQUFRLEdBQUcsUUFBUSxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3ZELE1BQU0sQ0FDSixRQUFRLENBQUMsU0FBUyxFQUFFLENBQUMsT0FBTyxFQUFFLEtBQUssbUJBQW1CLEVBQ3RELHVEQUF1RCxDQUN4RCxDQUFDO1lBQ0YsTUFBTSxZQUFZLEdBQUcsUUFBUSxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDcEQsSUFBSSxXQUFtQixDQUFDO1lBQ3hCLElBQUksWUFBWSxDQUFDLE9BQU8sRUFBRSxLQUFLLE1BQU0sRUFBRTtnQkFDckMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsQ0FBQztnQkFDdEMsV0FBVyxHQUFHLFlBQVksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQzthQUNsRDtpQkFBTTtnQkFDTCxXQUFXLEdBQUcsTUFBTSxDQUFDO2FBQ3RCO1lBQ0QsaUJBQWlCLENBQUMsY0FBYyxDQUFDLGNBQWMsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUNsRztLQUNGO0lBQ0QsSUFBSSxFQUFFLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FDakIsRUFBRSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLEVBQUUsRUFBQyxRQUFRLEVBQUUsTUFBTSxFQUFDLENBQUMsRUFDdEU7UUFDRSxVQUFVLEVBQUUsYUFBYSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDeEQsV0FBVztLQUNaLEVBQ0QsRUFBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUMsQ0FDakIsQ0FBQztJQUNGLEVBQUUsQ0FBQyxhQUFhLENBQUMsVUFBVSxFQUFFLEVBQUUsRUFBRSxFQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUMsQ0FBQyxDQUFDO0lBRXJELE1BQU0sWUFBWSxHQUFHLE9BQU8sR0FBRyxhQUFhLENBQUM7SUFDN0MsTUFBTSxlQUFlLEdBQUcsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQy9DLElBQUksZUFBZSxFQUFFO1FBQ25CLEVBQUUsR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxlQUFlLENBQUMsQ0FBQztLQUMzQztJQUNELG1CQUFtQjtJQUVuQixFQUFFLENBQUMsYUFBYSxDQUFDLFVBQVUsRUFBRSxFQUFFLEVBQUUsRUFBQyxRQUFRLEVBQUUsTUFBTSxFQUFDLENBQUMsQ0FBQztBQUN2RCxDQUFDO0FBL1JELGtDQStSQztBQUVELFNBQVMsTUFBTSxDQUFDLEtBQWMsRUFBRSxLQUFhO0lBQzNDLElBQUksQ0FBQyxLQUFLLEVBQUU7UUFDVixNQUFNLEtBQUssQ0FBQztLQUNiO0FBQ0gsQ0FBQztBQUVELE1BQU0sUUFBUSxHQUFHLENBQUMsSUFBWSxFQUFFLEVBQUU7SUFDaEMsSUFBSSxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQ3ZCLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxFQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUMsQ0FBQyxDQUFDLENBQUM7S0FDOUQ7SUFDRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUMsQ0FBQztBQUVGLE1BQU0sV0FBVyxHQXNCWCxFQUFFLENBQUM7QUFFVCxTQUFTLDBCQUEwQixDQUFDLENBQVk7SUFDOUMsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNuQyxPQUFPLE1BQU0sQ0FBQyxPQUFPLENBQUMsMkJBQTJCLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDekQsQ0FBQztBQUVELFNBQVMsV0FBVyxDQUNsQixjQUFzQixFQUN0QixJQUFZLEVBQ1osV0FBbUIsRUFDbkIsVUFBa0IsRUFDbEIsVUFBdUIsRUFDdkIsR0FBVyxFQUNYLE1BQWM7SUFFZCxNQUFNLFNBQVMsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBbUIsQ0FBQyxDQUFDLGdCQUF3QixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDdEgsTUFBTSxVQUFVLEdBQUcsaUJBQWlCLFVBQVUsMENBQTBDLFVBQVU7U0FDL0YsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFO1FBQ1AsTUFBTSxVQUFVLEdBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBbUIsQ0FBQyxDQUFDLGdCQUF3QixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO1FBQ2xHLE1BQU0sTUFBTSxHQUFHLDBCQUEwQixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzdDLElBQUksVUFBVSxLQUFLLEtBQUssRUFBRTtZQUN4QixPQUFPLEdBQUcsVUFBVSx3QkFBd0IsQ0FBQztTQUM5QzthQUFNO1lBQ0wsT0FBTyxHQUFHLFVBQVUsWUFBWSxNQUFNLFNBQVMsQ0FBQztTQUNqRDtJQUNILENBQUMsQ0FBQztTQUNELElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDO0lBRWhCLElBQUksVUFBVSxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsY0FBYyxLQUFLLGNBQWMsQ0FBQyxDQUFDO0lBQzVFLElBQUksQ0FBQyxVQUFVLEVBQUU7UUFDZixVQUFVLEdBQUcsRUFBQyxjQUFjLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRSxrQkFBa0IsRUFBRSxFQUFFLEVBQUUsZUFBZSxFQUFFLEVBQUUsRUFBQyxDQUFDO1FBQzFGLFdBQVcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7S0FDOUI7SUFFRCxNQUFNLFdBQVcsR0FBRyxRQUFRLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQzlDLFVBQVUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO1FBQ3hCLElBQUk7UUFDSixVQUFVO1FBQ1YsV0FBVztRQUNYLFVBQVU7UUFDVixHQUFHO1FBQ0gsV0FBVztRQUNYLE1BQU07UUFDTixTQUFTO0tBQ1YsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUNELFNBQVMsb0JBQW9CLENBQUMsY0FBc0IsRUFBRSxJQUFZLEVBQUUsV0FBbUIsRUFBRSxLQUFhO0lBQ3BHLElBQUksVUFBVSxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsY0FBYyxLQUFLLGNBQWMsQ0FBQyxDQUFDO0lBQzVFLElBQUksQ0FBQyxVQUFVLEVBQUU7UUFDZixVQUFVLEdBQUcsRUFBQyxjQUFjLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRSxrQkFBa0IsRUFBRSxFQUFFLEVBQUUsZUFBZSxFQUFFLEVBQUUsRUFBQyxDQUFDO1FBQzFGLFdBQVcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7S0FDOUI7SUFDRCxVQUFVLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDO1FBQ2pDLElBQUk7UUFDSixXQUFXO1FBQ1gsS0FBSztLQUNOLENBQUMsQ0FBQztBQUNMLENBQUM7QUFDRCxTQUFTLGlCQUFpQixDQUFDLGNBQXNCLEVBQUUsSUFBWSxFQUFFLFdBQW1CLEVBQUUsS0FBYTtJQUNqRyxJQUFJLFVBQVUsR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLGNBQWMsS0FBSyxjQUFjLENBQUMsQ0FBQztJQUM1RSxJQUFJLENBQUMsVUFBVSxFQUFFO1FBQ2YsVUFBVSxHQUFHLEVBQUMsY0FBYyxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUUsa0JBQWtCLEVBQUUsRUFBRSxFQUFFLGVBQWUsRUFBRSxFQUFFLEVBQUMsQ0FBQztRQUMxRixXQUFXLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0tBQzlCO0lBQ0QsVUFBVSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUM7UUFDOUIsSUFBSTtRQUNKLFdBQVc7UUFDWCxLQUFLO0tBQ04sQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELFNBQVMsWUFBWSxDQUFDLElBQVk7SUFDaEMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsRUFBRTtRQUNuQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUM1QixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxTQUFTLFFBQVEsQ0FBQyxFQUFVLEVBQUUsR0FBVztJQUN2QyxJQUFJLENBQUMsQ0FBQztJQUVOLE1BQU0sT0FBTyxHQUFhLEVBQUUsQ0FBQztJQUU3QixHQUFHO1FBQ0QsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDakIsSUFBSSxDQUFDLEVBQUU7WUFDTCxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ3BCO0tBQ0YsUUFBUSxDQUFDLEVBQUU7SUFDWixPQUFPLE9BQU8sQ0FBQztBQUNqQixDQUFDO0FBRUQsU0FBUyxTQUFTLENBQUMsTUFBaUIsRUFBRSxZQUFxQixJQUFJO0lBQzdELE9BQU8sTUFBTSxDQUFDLFlBQVk7U0FDdkIsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFO1FBQ1AsSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3RCLElBQUksU0FBUyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7WUFDN0MsR0FBRyxHQUFHLFNBQVMsR0FBRyxHQUFHLENBQUM7U0FDdkI7UUFDRCxPQUFPLEdBQUcsQ0FBQztJQUNiLENBQUMsQ0FBQztTQUNELElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNoQixDQUFDIn0=
