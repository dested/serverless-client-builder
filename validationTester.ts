import Project, {SourceFile, ts, Type} from 'ts-simple-ast';

export const validationMethods: string[] = [];

const methodNames: string[] = [];
export function buildValidatorMethod(name: string, symbol: Type<ts.Type>) {
  if (methodNames.find(a => a === name)) {
    return;
  }
  methodNames.push(name);
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
        console.log(name, fieldName);
        let type = a.getDeclarations()[0].getType();
        let typeText = type.getText(null, 1);
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
          buildValidatorMethod(fieldName, type);
          results.push(`this.${fieldName}Validator(${variable});`);
        } else {
          if (!type.isBoolean() && type.getUnionTypes().length > 0) {
            const unionConditional: string[] = [];
            for (const unionType of type.getUnionTypes()) {
              switch (unionType.getText(null, 1)) {
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
                    (unionType.getText(null, 1).startsWith("'") && unionType.getText(null, 1).endsWith("'")) ||
                    (unionType.getText(null, 1).startsWith('"') && unionType.getText(null, 1).endsWith('"'))
                  ) {
                    unionConditional.push(`${variable}!==${unionType.getText(null, 1)}`);
                  } else {
                    unionConditional.push(`this.${unionType.getText(null, 1)}Validator(${variable})`);
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
              case 'any':
/*
                results.push(
                  `if (typeof ${variable} !== 'boolean') throw new ValidationError('${name}', 'mismatch', '${fieldName}');`
                );
*/
                break;
              default:
                buildValidatorMethod(typeText, type);

                results.push(`this.${typeText}Validator(${variable})`);
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
  validationMethods.push(method);
}
/*

for (const test of tests) {
  const source = harness.start(`./validation-tests/${test}`);
  const symbolManager = new ManageSymbols();
  symbolManager.addSymbol(source.getExportedDeclarations()[0].getType());

  console.log(symbolManager.getSource());

  buildValidatorMethod(symbolManager.types[0].getSymbol().getName(), symbolManager.types[0]);
  let js = `
/!* This file was generated by https://github.com/dested/serverless-client-builder *!/
/!* tslint:disable *!/


export class ValidationError {
constructor(public model: string, reason: 'missing' | 'mismatch'|'too-many-fields', field: string) {}
}
export class RequestValidator {
${validationMethods.join('\r\n')}
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
*/
