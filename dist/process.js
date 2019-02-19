"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ejs = require("ejs");
const fs = require("fs");
const prettier = require("prettier");
const ts_simple_ast_1 = require("ts-simple-ast");
const manageSymbols_1 = require("./manageSymbols");
function processFile(apiPath, outputFile, legacyUrl) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3Byb2Nlc3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSwyQkFBMkI7QUFDM0IseUJBQXlCO0FBQ3pCLHFDQUFxQztBQUNyQyxpREFBeUU7QUFDekUsbURBQThDO0FBRTlDLFNBQWdCLFdBQVcsQ0FBQyxPQUFlLEVBQUUsVUFBa0IsRUFBRSxTQUFpQjtJQUNoRixNQUFNLFdBQVcsR0FBRyxDQUFDLFNBQVMsQ0FBQztJQUUvQixNQUFNLGdCQUFnQixHQUFHLE9BQU8sR0FBRyxlQUFlLENBQUM7SUFFbkQsTUFBTSxPQUFPLEdBQUcsSUFBSSx1QkFBTyxDQUFDO1FBQzFCLGdCQUFnQjtLQUNqQixDQUFDLENBQUM7SUFFSCxNQUFNLGFBQWEsR0FBRyxJQUFJLDZCQUFhLEVBQUUsQ0FBQztJQUMxQyxNQUFNLG1CQUFtQixHQUFxQixFQUFFLENBQUM7SUFDakQsS0FBSyxNQUFNLFVBQVUsSUFBSSxPQUFPLENBQUMsY0FBYyxFQUFFLEVBQUU7UUFDakQsS0FBSyxNQUFNLGdCQUFnQixJQUFJLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQywwQkFBVSxDQUFDLGdCQUFnQixDQUFDLEVBQUU7WUFDM0YsSUFDRSxnQkFBZ0IsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxNQUFNLEdBQUcsQ0FBQztnQkFDM0MsZ0JBQWdCLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLEtBQUssWUFBWSxFQUM5RDtnQkFDQSxNQUFNLGNBQWMsR0FBRyxnQkFBZ0I7cUJBQ3BDLGFBQWEsRUFBRSxDQUFDLENBQUMsQ0FBQztxQkFDbEIsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDO3FCQUNqQixPQUFPLEVBQUUsQ0FBQztnQkFFYixNQUFNLGNBQWMsR0FBbUI7b0JBQ3JDLElBQUksRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDO29CQUMxQixPQUFPLEVBQUUsRUFBRTtvQkFDWCxVQUFVLEVB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