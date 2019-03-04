import * as fs from 'fs';
import * as prettier from 'prettier';
import Project, {SourceFile, ts, Type} from 'ts-simple-ast';
import {ManageSymbols} from './manageSymbols';

export class Harness {
  start(path: string) {
    const project = new Project({tsConfigFilePath: './tsconfig.json'});
    return project.getSourceFile(path);
  }

  equal(source: SourceFile, symbolManager: ManageSymbols) {
    const left = source.getFullText().replace(/\s/g, '');
    const right = symbolManager.getSource().replace(/\s/g, '');
    if (left !== right) {
      console.log(source.getFullText());
      console.log('--------');
      console.log(symbolManager.getSource());
    }
    return left === right;
  }
}

const tests = fs.readdirSync('./validation-tests');
const harness = new Harness();
const methods: string[] = [];

function buildValidator(name: string, symbol: Type<ts.Type>) {
  const method = `
  static ${name}Validator(model: any):boolean {
    let fieldCount=0;
    if(model===null)
      throw new ValidationError('${name}', 'missing', '');
    if(typeof model!=='object')
      throw new ValidationError('${name}', 'mismatch', '');
    
    ${symbol
      .getProperties()
      .map(a => {
        const fieldName = a.getName();
        let type = a.getDeclarations()[0].getType();
        let typeText = type.getText();
        const results: string[] = [];
        let optional = false;
        if ((a.getValueDeclaration() as any).getQuestionTokenNode()) {
          optional = true;
        }

        let variable = `model.${fieldName}`;

        let isArray = false;
        if (type.isArray()) {
          isArray = true;
          typeText = type.getArrayType().getText(null, 1);
        }

        if (!optional) {
          results.push(`if (${variable} === null) throw new ValidationError('${name}', 'missing', '${fieldName}');`);
        } else {
          results.push(`if ('${fieldName}' in model) {`);
        }

        results.push(`fieldCount++;`);

        if (isArray) {
          results.push(
            `if (typeof ${variable} !== 'object' || !('length' in ${variable})) throw new ValidationError('${name}', 'mismatch', '${fieldName}');`
          );
          results.push(`for (let i = 0; i < ${variable}.length; i++) { const ${fieldName}Elem = ${variable}[i];`);
          variable = `${fieldName}Elem`;
          type = type.getArrayType();
        }

        if (typeText.startsWith('{') && typeText.endsWith('}')) {
          buildValidator(name + '_' + fieldName, type);
          results.push(`this.${name + '_' + fieldName}Validator(${variable});`);
        } else {
          if (!type.isBoolean() && type.getUnionTypes().length > 0) {
            const unionConditional: string[] = [];
            for (const unionType of type.getUnionTypes()) {
              switch (unionType.getText()) {
                case 'string':
                  unionConditional.push(`typeof ${variable} !== 'string'`);
                  break;
                case 'number':
                  unionConditional.push(`typeof ${variable} !== 'number'`);
                  break;
                case 'boolean':
                  unionConditional.push(`typeof ${variable} !== 'boolean'`);
                  break;
                default:
                  if (
                    (unionType.getText().startsWith("'") && unionType.getText().endsWith("'")) ||
                    (unionType.getText().startsWith('"') && unionType.getText().endsWith('"'))
                  ) {
                    unionConditional.push(`${variable}!==${unionType.getText()}`);
                  } else {
                    unionConditional.push(`this.${unionType.getText()}Validator(${variable})`);
                  }
                  break;
              }
            }
            results.push(
              `if (${unionConditional.join('&&')}) throw new ValidationError('${name}', 'mismatch', '${fieldName}');`
            );
          } else {
            switch (typeText) {
              case 'string':
                results.push(
                  `if (typeof ${variable} !== 'string') throw new ValidationError('${name}', 'mismatch', '${fieldName}');`
                );
                break;
              case 'number':
                results.push(
                  `if (typeof ${variable} !== 'number') throw new ValidationError('${name}', 'mismatch', '${fieldName}');`
                );
                break;
              case 'boolean':
                results.push(
                  `if (typeof ${variable} !== 'boolean') throw new ValidationError('${name}', 'mismatch', '${fieldName}');`
                );
                break;
              default:
                buildValidator(name + '_' + typeText, type);

                results.push(`this.${name + '_' + typeText}Validator(${variable})`);
                break;
            }
          }
        }
        if (isArray) {
          results.push(`}`);
        }
        if (optional) {
          results.push(`}`);
        }
        return results.join('\r\n');
      })
      .join('\r\n')}
      
      if(Object.keys(model).length!==fieldCount)throw new ValidationError('${name}', 'too-many-fields', '');
      
      return true;
      } 
  `;
  methods.push(method);
}

for (const test of tests) {
  const source = harness.start(`./validation-tests/${test}`);
  const symbolManager = new ManageSymbols();
  symbolManager.addSymbol(source.getExportedDeclarations()[0].getType());

  console.log(symbolManager.getSource());

  buildValidator(symbolManager.types[0].getSymbol().getName(), symbolManager.types[0]);
  let js = `
/* This file was generated by https://github.com/dested/serverless-client-builder */
/* tslint:disable */
  
  
export class ValidationError {
constructor(public model: string, reason: 'missing' | 'mismatch'|'too-many-fields', field: string) {}
}
export class RequestValidator {
${methods.join('\r\n')}
}
`;

  const apiPath = './';

  const prettierFile = apiPath + '.prettierrc';
  const prettierOptions = readJson(prettierFile);
  if (prettierOptions) {
    js = prettier.format(js, prettierOptions);
  }

  fs.writeFileSync('./result.ts', js, {encoding: 'utf8'});
}

function readJson(path: string) {
  if (fs.existsSync(path)) {
    return JSON.parse(fs.readFileSync(path, {encoding: 'utf8'}));
  }
  return null;
}
