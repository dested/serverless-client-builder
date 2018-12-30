"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ejs = require("ejs");
const fs = require("fs");
const prettier = require("prettier");
const ts_simple_ast_1 = require("ts-simple-ast");
const manageSymbols_1 = require("./manageSymbols");
function processFile(apiPath, outputFile) {
    const extendedUrl = true;
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
                    }
                }
            }
        }
    }
    const header = fs.readFileSync(apiPath + 'serverless-header.yml', { encoding: 'utf8' });
    let bottom = '';
    for (const controllerDataItem of controllerDataItems) {
        for (const method of controllerDataItem.methods) {
            bottom += `
  ${controllerDataItem.name}_${method.name}:
    handler: handler.${controllerDataItem.name}_${method.name}
    ${method.options.map(a => `${a.key}: ${a.value}`).join('\r\n    ')}
    events:
      - http:
          path: ${extendedUrl ? `${controllerDataItem.name}/` : ''}${method.path}
          method: ${method.method}
          cors: true`;
        }
        for (const event of controllerDataItem.events) {
            bottom += `
  ${controllerDataItem.name}_${event.name}:
    handler: handler.${controllerDataItem.name}_${event.name}
    events:
${event.rate.map(a => `      - schedule: ${a}`).join('\r\n')}`;
        }
        for (const websocket of controllerDataItem.websockets) {
            bottom += `
  ${controllerDataItem.name}_${websocket.name}:
    handler: handler.${controllerDataItem.name}_${websocket.name}
    events:
${websocket.routeKey.map(a => `      - websocket:\r\n          routeKey: ${a}`).join('\r\n')}`;
        }
    }
    const disclaimer = '# This file was generated by https://github.com/dested/serverless-client-builder\r\n';
    fs.writeFileSync(apiPath + 'serverless.yml', disclaimer + header + bottom, { encoding: 'utf8' });
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
        controller = { controllerName, functions: [] };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3Byb2Nlc3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSwyQkFBMkI7QUFDM0IseUJBQXlCO0FBQ3pCLHFDQUFxQztBQUNyQyxpREFBeUU7QUFDekUsbURBQThDO0FBRTlDLFNBQWdCLFdBQVcsQ0FBQyxPQUFlLEVBQUUsVUFBa0I7SUFDN0QsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDO0lBRXpCLE1BQU0sZ0JBQWdCLEdBQUcsT0FBTyxHQUFHLGVBQWUsQ0FBQztJQUVuRCxNQUFNLE9BQU8sR0FBRyxJQUFJLHVCQUFPLENBQUM7UUFDMUIsZ0JBQWdCO0tBQ2pCLENBQUMsQ0FBQztJQUVILE1BQU0sYUFBYSxHQUFHLElBQUksNkJBQWEsRUFBRSxDQUFDO0lBQzFDLE1BQU0sbUJBQW1CLEdBQXFCLEVBQUUsQ0FBQztJQUNqRCxLQUFLLE1BQU0sVUFBVSxJQUFJLE9BQU8sQ0FBQyxjQUFjLEVBQUUsRUFBRTtRQUNqRCxLQUFLLE1BQU0sZ0JBQWdCLElBQUksVUFBVSxDQUFDLG9CQUFvQixDQUFDLDBCQUFVLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtZQUMzRixJQUNFLGdCQUFnQixDQUFDLGFBQWEsRUFBRSxDQUFDLE1BQU0sR0FBRyxDQUFDO2dCQUMzQyxnQkFBZ0IsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsS0FBSyxZQUFZLEVBQzlEO2dCQUNBLE1BQU0sY0FBYyxHQUFHLGdCQUFnQjtxQkFDcEMsYUFBYSxFQUFFLENBQUMsQ0FBQyxDQUFDO3FCQUNsQixZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7cUJBQ2pCLE9BQU8sRUFBRSxDQUFDO2dCQUViLE1BQU0sY0FBYyxHQUFtQjtvQkFDckMsSUFBSSxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUM7b0JBQzFCLE9BQU8sRUFBRSxFQUFFO29CQUNYLFVBQVUsRUFBRSxFQUFFO29CQUNkLE1B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