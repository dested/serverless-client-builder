"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processFile = void 0;
// https://github.com/YousefED/typescript-json-schema
const ejs = require("ejs");
const fs = require("fs");
const prettier = require("prettier");
const ts_morph_1 = require("ts-morph");
const manageSymbols_1 = require("./manageSymbols");
const validationTester_1 = require("./validationTester");
const utils_1 = require("./utils");
const requestSymbolManager = new manageSymbols_1.ManageSymbols();
function processFile(apiPath, outputFiles, noValidation, noYaml, templateV2, templateV3, openApi) {
    var _a, _b;
    const templateVersion = templateV2 ? './templateV2.ejs' : templateV3 ? './templateV3.ejs' : './template.ejs';
    console.time('parse');
    const tsConfigFilePath = apiPath + 'tsconfig.json';
    const project = new ts_morph_1.Project({
        tsConfigFilePath,
    });
    console.timeEnd('parse');
    console.time('get controllers');
    const symbolManager = new manageSymbols_1.ManageSymbols();
    const controllerDataItems = [];
    for (const sourceFile of project.getSourceFiles()) {
        for (const classDeclaration of sourceFile.getDescendantsOfKind(ts_morph_1.SyntaxKind.ClassDeclaration)) {
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
                            const data = controllerData.events.find((a) => a.name === methodName);
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
                            const data = controllerData.websockets.find((a) => a.name === methodName);
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
            for (const method of controllerDataItem.methods.filter((a) => a.options.find((b) => b.key === 'bespoke'))) {
                const options = method.options
                    .filter((a) => a.key !== 'bespoke')
                    .map((a) => `    ${a.key}: ${a.value}`)
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
${event.options.map((a) => `    ${a.key}: ${a.value}`).join('\r\n') + '\r\n'}    events:
${event.rate.map((a) => `      - schedule: ${a}`).join('\r\n') + '\r\n'}`;
            }
            for (const websocket of controllerDataItem.websockets) {
                mainServerless += `
  ${controllerDataItem.name}_${websocket.name}:
    handler: handler.${controllerDataItem.name}_${websocket.name}
    events:
${websocket.routeKey
                    .map((a) => `      - websocket: 
         route: ${a}`)
                    .join('\r\n')}`;
            }
        }
        fs.writeFileSync(apiPath + 'serverless.yml', mainServerless, { encoding: 'utf8' });
        console.timeEnd('write yaml');
    }
    console.time('parse controllers');
    for (const controllerDataItem of controllerDataItems) {
        for (const method of controllerDataItem.methods) {
            const funcName = method.name;
            const funcNode = method.declaration;
            assert(funcNode.getParameters().length >= 1, 'The export must have a request model parameter');
            const firstParameter = funcNode.getParameters()[0];
            const eventArg = firstParameter.getType();
            const typeArgument = eventArg;
            let requestName;
            symbolManager.addSymbol(firstParameter, true);
            requestName = typeArgument.getSymbol().getName();
            requestSymbolManager.addSymbol(firstParameter, true);
            const returnType = funcNode.getReturnType();
            assert(returnType.getSymbol().getName() === 'Promise', 'Return type must must be a promise');
            const httpResponseTypeArgument = returnType.getTypeArguments()[0].getSymbol().getDeclarations()[0];
            symbolManager.addSymbol(httpResponseTypeArgument, true);
            addFunction(method.controllerName, funcName, requestName, httpResponseTypeArgument.getSymbol().getName(), method.options.find((a) => a.key === 'statusCodes').value, `/${controllerDataItem.route || controllerDataItem.name}/${method.path}`, method.method, (_a = method.options.find((a) => a.key === 'description')) === null || _a === void 0 ? void 0 : _a.value, !!((_b = method.options.find((a) => a.key === 'auth')) === null || _b === void 0 ? void 0 : _b.value));
        }
        for (const websocket of controllerDataItem.websockets) {
            if (websocket.routeKey.find((a) => a[0] === '$')) {
                continue;
            }
            const funcName = websocket.name;
            const funcNode = websocket.declaration;
            assert(funcNode.getParameters().length === 1, `${funcName} The export must only have one parameter`);
            const eventArg = funcNode.getParameters()[0].getType();
            assert(eventArg.getSymbol().getName() === 'WebsocketRequestEvent', 'WebsocketRequestEvent argument must be a generic event class');
            const typeArgument = eventArg.getTypeArguments()[0].getSymbol().getDeclarations()[0];
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
                    const typeArgument = eventArg.getTypeArguments()[0].getSymbol().getDeclarations()[0];
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
    console.timeEnd('parse controllers');
    if (!openApi) {
        console.time('write template');
        let js = ejs.render(fs.readFileSync(require.resolve(templateVersion), { encoding: 'utf8' }), {
            interfaces: utils_1.Utils.unique([...symbolManager.types], (e) => e.getText(undefined, ts_morph_1.TypeFormatFlags.NoTruncation)).map((a) => getSource(a)),
            controllers,
        }, { escape: (e) => e });
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
        const interfaces = [...symbolManager.types]
            .filter((a) => !a.isUnion())
            .map((a) => {
            return {
                name: (a.getSymbol() || a.getAliasSymbol()).getEscapedName(),
                fields: a.getProperties().map((topP) => {
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
                            switch ((_b = (_a = typeV.getSymbol()) === null || _a === void 0 ? void 0 : _a.getEscapedName()) !== null && _b !== void 0 ? _b : typeV.getText()) {
                                case 'string':
                                case 'number':
                                case 'boolean':
                                    type = 'type: ' + typeV.getText();
                                    break;
                                case 'Array':
                                    if (typeV.getArrayElementType().getSymbol()) {
                                        type = `type: array
          items:
            $ref: '#/components/schemas/${typeV.getArrayElementType().getSymbol().getEscapedName()}'`;
                                    }
                                    else {
                                        type = `type: array
          items:
            type: ${typeV.getArrayElementType().getText()}`;
                                    }
                                    break;
                                default:
                                    type = `
          $ref: '#/components/schemas/${((_c = typeV.getSymbol()) !== null && _c !== void 0 ? _c : typeV.getAliasSymbol()).getEscapedName()}'`;
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
        }, { escape: (e) => e });
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
    var _a, _b, _c, _d;
    for (const t of requestSymbolManager.types) {
        const declaredType = (_a = t.getSymbol()) === null || _a === void 0 ? void 0 : _a.getDeclaredType();
        if (!declaredType) {
            continue;
        }
        const name = t.getText(undefined, ts_morph_1.TypeFormatFlags.NoTruncation);
        if (name.indexOf('Array') === 0)
            continue;
        if (name.indexOf('ObjectId') === 0)
            continue;
        if (name.indexOf('ObjectID') === 0)
            continue;
        if (name.indexOf('Date') === 0)
            continue;
        if (name.indexOf('{') === 0)
            continue;
        const str = (_d = (_c = ((_b = t.getSymbol()) !== null && _b !== void 0 ? _b : t.getAliasSymbol())) === null || _c === void 0 ? void 0 : _c.getDeclarations()[0]) === null || _d === void 0 ? void 0 : _d.getText();
        if (!str)
            continue;
        if (str.indexOf('interface Array') === 0)
            continue;
        /*
        if (str.indexOf('{') === 0) {
          str = 'type ' + name + ' = ' + str;
        }
    */
        const apiFullPath = fs.realpathSync(apiPath).replace(/\\/g, '/');
        const text = declaredType.getText().replace(apiFullPath, '..');
        validationTester_1.buildValidatorMethod(apiFullPath, t.getSymbol().getName(), text, t);
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
    if (!errorTypes.find((a) => a === 401)) {
        errorTypes.push(401);
    }
    const handleType = `{200?:(result:${returnType})=>void,500?:(result:string)=>void,${errorTypes
        .map((a) => {
        const statusCode = a;
        if (statusCode === 401) {
            return `${statusCode}?:(error:string)=>void`;
        }
        else {
            return `${statusCode}:(result:{error:string})=>void`;
        }
    })
        .join(',')}}`;
    let controller = controllers.find((a) => a.controllerName === controllerName);
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
    let controller = controllers.find((a) => a.controllerName === controllerName);
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
    let controller = controllers.find((a) => a.controllerName === controllerName);
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
    return name.replace(/-([a-z])/g, (g) => {
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
function getSource(t, addExport = true) {
    var _a, _b, _c;
    if (!t)
        return '';
    const name = t.getText(undefined, ts_morph_1.TypeFormatFlags.NoTruncation);
    if (name.indexOf('ObjectId') === 0)
        return '';
    if (name.indexOf('ObjectID') === 0)
        return '';
    if (name.indexOf('Array') === 0)
        return '';
    if (name.indexOf('Date') === 0)
        return '';
    if (name.indexOf('{') === 0)
        return '';
    let str = (_c = (_b = ((_a = t.getSymbol()) !== null && _a !== void 0 ? _a : t.getAliasSymbol())) === null || _b === void 0 ? void 0 : _b.getDeclarations()[0]) === null || _c === void 0 ? void 0 : _c.getText();
    if (!str)
        return '';
    if (str.indexOf('interface Array') === 0)
        return '';
    if (str.indexOf('{') === 0) {
        str = 'type ' + name + ' = ' + str;
    }
    if (addExport && str.indexOf('export') === -1) {
        str = 'export ' + str;
    }
    return str;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3Byb2Nlc3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQXFEO0FBQ3JELDJCQUEyQjtBQUMzQix5QkFBeUI7QUFDekIscUNBQXFDO0FBQ3JDLHVDQUErRjtBQUMvRixtREFBOEM7QUFDOUMseURBQTJFO0FBQzNFLG1DQUE4QjtBQUU5QixNQUFNLG9CQUFvQixHQUFHLElBQUksNkJBQWEsRUFBRSxDQUFDO0FBRWpELFNBQWdCLFdBQVcsQ0FDekIsT0FBZSxFQUNmLFdBQXFCLEVBQ3JCLFlBQXFCLEVBQ3JCLE1BQWUsRUFDZixVQUFtQixFQUNuQixVQUFtQixFQUNuQixPQUFlOztJQUVmLE1BQU0sZUFBZSxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLGdCQUFnQixDQUFDO0lBRTdHLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDdEIsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLEdBQUcsZUFBZSxDQUFDO0lBRW5ELE1BQU0sT0FBTyxHQUFHLElBQUksa0JBQU8sQ0FBQztRQUMxQixnQkFBZ0I7S0FDakIsQ0FBQyxDQUFDO0lBQ0gsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUV6QixPQUFPLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFFaEMsTUFBTSxhQUFhLEdBQUcsSUFBSSw2QkFBYSxFQUFFLENBQUM7SUFDMUMsTUFBTSxtQkFBbUIsR0FBcUIsRUFBRSxDQUFDO0lBQ2pELEtBQUssTUFBTSxVQUFVLElBQUksT0FBTyxDQUFDLGNBQWMsRUFBRSxFQUFFO1FBQ2pELEtBQUssTUFBTSxnQkFBZ0IsSUFBSSxVQUFVLENBQUMsb0JBQW9CLENBQUMscUJBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFF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