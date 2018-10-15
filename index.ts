import * as ejs from 'ejs';
import * as fs from 'fs';
import * as prettier from 'prettier';
import Project, {ScriptTarget, Symbol, ts, TypeGuards} from 'ts-simple-ast';
import * as yamljs from 'yamljs';

const readJson = (path: string) => {
  return JSON.parse(fs.readFileSync(require.resolve(path), {encoding: 'utf8'}));
};

function process(tsConfigFilePath: string, serverlessFilePath: string, prettierFile: string, outputFile: string) {
  const serverlessConfig = yamljs.load(serverlessFilePath);
  const project = new Project({
    tsConfigFilePath,
  });

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
      assert(eventArg.getSymbol().getName() === 'Event', 'Event argument must be a generic event class');
      const typeArgument = eventArg.getTypeArguments()[0];
      let requestName: string;
      if (typeArgument.getText() !== 'void') {
        addSymbol(typeArgument.getSymbol());
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
      addSymbol(httpResponseTypeArgument.getSymbol());
      addFunction(funcName, requestName, httpResponseTypeArgument.getSymbol().getName());
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
      interfaces: symbols.map(a => getSource(a)),
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
}[] = [];

function addFunction(name: string, requestType: string, returnType: string) {
  functions.push({name, requestType, returnType, url: '', method: '', found: false});
}

const symbols: ts.Symbol[] = [];

function addSymbol(symbol: Symbol) {
  if (symbol.getName() !== '__type') {
    if (!symbols.find(a => a === symbol.compilerSymbol)) {
      symbols.push(symbol.compilerSymbol);
    }
  }

  const baseTypes = symbol
    .getDeclaredType()
    .getBaseTypes()
    .map(a => a.getSymbol());

  if (baseTypes.length > 0) {
    for (const baseType of baseTypes) {
      // console.log('1', baseType);
      addSymbol(baseType);
    }
  }

  for (const member of symbol.getMembers()) {
    const memberType = member.getDeclarations()[0].getType();
    if (memberType.isArray()) {
      switch (memberType.getTypeArguments()[0].getText()) {
        case 'any':
        case 'string':
        case 'boolean':
        case 'number':
          break;
        default:
          const symbol1 = memberType.getTypeArguments()[0].getSymbol();
          // console.log('2', symbol1);
          addSymbol(symbol1);
          break;
      }
    } else {
      switch (memberType.getText()) {
        case 'any':
        case 'string':
        case 'boolean':
        case 'number':
          break;
        default:
          if (memberType.getSymbol()) {
            // console.log('3', memberType);
            addSymbol(memberType.getSymbol());
          } else {
            const aliasSymbol = memberType.getAliasSymbol();
            if (memberType.getAliasSymbol()) {
              addSymbol(aliasSymbol);
            }
          }
          break;
      }
    }
  }
}

function getSource(symbol: ts.Symbol) {
  return symbol.declarations
    .map(a => {
      let str = a.getText();
      if (str.indexOf('export') === -1) {
        str = 'export ' + str;
      }
      return str;
    })
    .join('\n');
}
process(
  'C:\\code\\cleverrx\\api\\tsconfig.json',
  'C:\\code\\cleverrx\\api\\serverless.yml',
  'C:\\code\\cleverrx\\api\\.prettierrc',
  'C:\\code\\cleverrx\\web\\src\\dataServices\\app.generated.ts'
);
