import * as ejs from 'ejs';
import * as fs from 'fs';
import * as prettier from 'prettier';
import Project, {ScriptTarget, Symbol, ts, Type, TypeGuards} from 'ts-simple-ast';
import * as yamljs from 'yamljs';
import {ManageSymbols} from './manageSymbols';

const readJson = (path: string) => {
  return JSON.parse(fs.readFileSync(require.resolve(path), {encoding: 'utf8'}));
};

function process(tsConfigFilePath: string, serverlessFilePath: string, prettierFile: string, outputFile: string) {
  const serverlessConfig = yamljs.load(serverlessFilePath);
  const project = new Project({
    tsConfigFilePath,
  });

  const symbolManager = new ManageSymbols();

  const h = project.getSourceFile('handler.ts');
  /*  tsquery(h.compilerNode, '*', {visitAllChildren: true}); */

  const funcs = h
    .getChildren()[0]
    .getChildren()
    .filter(a => a.getText().startsWith('module.exports'));

  assert(funcs.length > 0, 'No module.exports found');

  for (const func of funcs) {
    const funcName = func
      .getChildren()[0]
      .getChildren()[0]
      .getText()
      .split('.')[2];

    const funcNode = func.getChildren()[0].getChildren()[2];
    assert(TypeGuards.isArrowFunction(funcNode), 'You did not set the module.export to an arrow function');
    if (TypeGuards.isArrowFunction(funcNode)) {
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
      addFunction(funcName, requestName, httpResponseTypeArgument.getSymbol().getName(), errorTypes);
    }
  }

  for (const serverlessFuncName in serverlessConfig.functions) {
    if (serverlessConfig.functions.hasOwnProperty(serverlessFuncName)) {
      const serverlessFunc = serverlessConfig.functions[serverlessFuncName];
      const func = functions.find(a => a.name === serverlessFunc.handler.replace('handler.', ''));
      assert(!!func, 'Function not found in yaml ' + serverlessFuncName);
      const http = serverlessFunc.events[0].http;
      func.url = '/' + http.path;
      func.method = http.method;
      func.found = true;
    }
  }
  functions = functions.filter(a => a.found);

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

let functions: {
  found: boolean;
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

function addFunction(name: string, requestType: string, returnType: string, errorTypes: ts.Symbol[]) {
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
    url: '',
    method: '',
    found: false,
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

/*process(
  '/Users/sal/code/styr/CleverRX/api/tsconfig.json',
  '/Users/sal/code/styr/CleverRX/api/serverless.yml',
  '/Users/sal/code/styr/CleverRX/api/.prettierrc',
  '/Users/sal/code/styr/CleverRX/app/src/dataServices/app.generated.ts'
);*/

process(
  'c:/code/CleverRX/api/tsconfig.json',
  'c:/code/CleverRX/api/serverless.yml',
  'c:/code/CleverRX/api/.prettierrc',
  'c:/code/CleverRX/app/src/dataServices/app.generated.ts'
);
