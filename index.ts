import * as ejs from 'ejs';
import * as fs from 'fs';
import * as prettier from 'prettier';
import Project, {MethodDeclaration, SyntaxKind, ts, TypeGuards} from 'ts-simple-ast';
import {ManageSymbols} from './manageSymbols';

const readJson = (path: string) => {
  return JSON.parse(fs.readFileSync(require.resolve(path), {encoding: 'utf8'}));
};

function processFile(apiPath: string, outputFile: string) {
  const tsConfigFilePath = apiPath + 'tsconfig.json';
  const prettierFile = apiPath + '.prettierrc';

  const project = new Project({
    tsConfigFilePath,
  });

  const symbolManager = new ManageSymbols();
  const controllerDataItems: ControllerData[] = [];
  for (const sourceFile of project.getSourceFiles()) {
    for (const classDeclaration of sourceFile.getDescendantsOfKind(SyntaxKind.ClassDeclaration)) {
      if (
        classDeclaration.getDecorators().length > 0 &&
        classDeclaration.getDecorators()[0].getName() === 'controller'
      ) {
        const controllerName = classDeclaration
          .getDecorators()[0]
          .getArguments()[0]
          .getText();

        const controllerData: ControllerData = {name: eval(controllerName), methods: []};
        controllerDataItems.push(controllerData);
        for (const methodDeclaration of classDeclaration.getMethods()) {
          if (methodDeclaration.getDecorator('request')) {
            const methodName = methodDeclaration.getName();
            const requestDecorator = methodDeclaration.getDecorator('request');
            const requestMethod = eval(requestDecorator.getArguments()[0].getText());
            const requestPath = eval(requestDecorator.getArguments()[1].getText());
            const options: {key: string; value: string}[] = [];
            if (requestDecorator.getArguments()[2]) {
              const text = requestDecorator.getArguments()[2].getText();
              const requestOptions = eval('(' + text + ')');
              if (requestOptions) {
                for (const key of Object.keys(requestOptions)) {
                  options.push({key, value: requestOptions[key]});
                }
              }
            }
            controllerData.methods.push({
              controllerName: controllerData.name,
              name: methodName,
              method: requestMethod,
              path: requestPath,
              options,
              declaration: methodDeclaration,
            });
          }
        }
      }
    }
  }

  if (process.argv[2] === 'yml') {
    const header = fs.readFileSync(apiPath + 'serverless-header.yml', {encoding: 'utf8'});
    let bottom = '';
    for (const controllerDataItem of controllerDataItems) {
      for (const method of controllerDataItem.methods) {
        bottom += `
  ${method.name}:
    handler: handler.${controllerDataItem.name}_${method.name}
    ${method.options.map(a => `${a.key}: ${a.value}`).join('\r\n    ')}
    events:
      - http:
          path: ${method.path}
          method: ${method.method}
          cors: true`;
      }
    }
    fs.writeFileSync(apiPath + 'serverless.yml', header + bottom, {encoding: 'utf8'});
    console.log('Wrote yml file');
    return;
  }

  for (const controllerDataItem of controllerDataItems) {
    for (const method of controllerDataItem.methods) {
      const funcName = method.controllerName + 'Controller_' + method.name;

      const funcNode = method.declaration;

      assert(funcNode.getParameters().length === 1, 'The export must only have one parameter');
      const eventArg = funcNode.getParameters()[0].getType();
      assert(eventArg.getSymbol().getName() === 'RequestEvent', 'RequestEvent argument must be a generic event class');
      const typeArgument = eventArg.getTypeArguments()[0];
      let requestName: string;
      if (typeArgument.getText() !== 'void') {
        symbolManager.addSymbol(typeArgument);
        requestName = typeArgument.getSymbol().getName();
      } else {
        requestName = 'void';
      }

      const returnType = funcNode.getReturnType();
      assert(returnType.getSymbol().getName() === 'Promise', 'Return type must must be a promise');
      const returnTypeArgument = returnType.getTypeArguments()[0];
      assert(
        returnTypeArgument.getSymbol().getName() === 'HttpResponse',
        'Return type must must be a promise of HttpResponse'
      );
      const httpResponseTypeArgument = returnTypeArgument.getTypeArguments()[0];
      const httpResponseErrorArgument = returnTypeArgument.getTypeArguments()[1];

      const errorTypes: ts.Symbol[] = [];

      if ((httpResponseErrorArgument.compilerType as any).intrinsicName !== 'undefined') {
        if (httpResponseErrorArgument.getUnionTypes().length === 0) {
          errorTypes.push(httpResponseErrorArgument.getApparentType().compilerType.getSymbol());
        } else {
          for (const unionType of httpResponseErrorArgument.getUnionTypes()) {
            errorTypes.push(unionType.compilerType.getSymbol());
          }
        }
      }
      symbolManager.addSymbol(httpResponseTypeArgument);
      addFunction(
        funcName,
        requestName,
        httpResponseTypeArgument.getSymbol().getName(),
        errorTypes,
        '/' + method.path,
        method.method
      );
    }
  }

  let js = ejs.render(
    fs.readFileSync('./template.ejs', {encoding: 'utf8'}),
    {
      interfaces: symbolManager.symbols.map(a => getSource(a)),
      functions,
    },
    {escape: e => e}
  );

  js = prettier.format(js, readJson(prettierFile));

  // console.log(js);

  fs.writeFileSync(outputFile, js, {encoding: 'utf8'});
}

function assert(thing: boolean, error: string) {
  if (!thing) {
    throw error;
  }
}

const functions: {
  url: string;
  method: string;
  name: string;
  requestType: string;
  returnType: string;
  errorCode: string[];
  handleType: string;
}[] = [];

function getSourceWithoutStatusCode(a: ts.Symbol) {
  const source = getSource(a, false);
  return source.replace(/statusCode\s*:\s*\d+,?;?/g, '');
}

function addFunction(
  name: string,
  requestType: string,
  returnType: string,
  errorTypes: ts.Symbol[],
  url: string,
  method: string
) {
  const errorCode = errorTypes.map(a => (a.members.get('statusCode' as any).valueDeclaration as any).type.literal.text);
  const handleType = `{200:(result:${returnType})=>TPromise,500:(result:string)=>void,${errorTypes
    .map(a => {
      const statusCode = (a.members.get('statusCode' as any).valueDeclaration as any).type.literal.text;
      const source = getSourceWithoutStatusCode(a);
      return `${statusCode}:(result:${source})=>void`;
    })
    .join(',')}}`;
  functions.push({
    name,
    handleType,
    requestType,
    returnType,
    url,
    method,
    errorCode,
  });
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
  name: string;
  methods: ControllerMethodData[];
}
export interface ControllerMethodData {
  controllerName: string;
  name: string;
  method: string;
  path: string;
  options: {key: string; value: string}[];
  declaration: MethodDeclaration;
}

/*processFile(
  '/Users/sal/code/styr/CleverRX/api/',
  '/Users/sal/code/styr/CleverRX/app/src/dataServices/app.generated.ts'
);*/

processFile('c:/code/CleverRX/api/', 'c:/code/CleverRX/app/src/dataServices/app.generated.ts');
