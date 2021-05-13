import {Type} from 'ts-morph';

export const validationMethods: string[] = [];

const methodNames: string[] = [];

export function buildValidatorMethod(apiFullPath: string, name: string, fullType: string, symbol: Type) {
  if (name === 'ObjectId' || name === 'ObjectID') {
    validationMethods.push(`static validate${name}(model: any):boolean {
    if(typeof model==='string')return true;
    return false;
    }`);
    return;
  }

  if (methodNames.find((a) => a === name)) {
    return;
  }
  methodNames.push(name);

  // console.log(name);
  const method = `
  static validate${name}(model: ${fullType}):boolean {
    let fieldCount=0;
    if(model===null)
      throw new ValidationError('${name}', 'missing', '');
    if(typeof model!=='object')
      throw new ValidationError('${name}', 'mismatch', '');
    
    ${symbol
      .getProperties()
      .map((property) => {
        const fieldName = property.getName();
        // console.log(name, fieldName);
        let type = property.getDeclarations()[0].getType();
        if (type.isUnion() && type.getUnionTypes().length === 2 && type.getUnionTypes()[0].isUndefined()) {
          type = type.getUnionTypes()[1];
        }
        let typeText = type.getText(null, 1);
        const results: string[] = [];
        let optional = false;
        if (property.getValueDeclaration() && (property.getValueDeclaration() as any).getQuestionTokenNode?.()) {
          optional = true;
        }

        let variable = `model['${fieldName}']`;

        let isArray = false;
        if (type.isArray()) {
          isArray = true;
          typeText = type.getArrayElementType().getText(null, 1);
        }

        if (!optional) {
          results.push(`if (${variable} === null) throw new ValidationError('${name}', 'missing', '${fieldName}');`);
          results.push(`fieldCount++;`);
        } else {
          results.push(`if ('${fieldName}' in model) {`);
          results.push(`fieldCount++;`);
          results.push(`if (model['${fieldName}']!==null && model['${fieldName}']!==undefined) {`);
        }

        if (isArray) {
          results.push(
            `if (typeof ${variable} !== 'object' || !('length' in ${variable})) throw new ValidationError('${name}', 'mismatch', '${fieldName}');`
          );
          results.push(`for (let i = 0; i < ${variable}.length; i++) { const ${fieldName}Elem = ${variable}[i];`);
          variable = `${fieldName}Elem`;
          type = type.getArrayElementType();
        }

        if (typeText.startsWith('{') && typeText.endsWith('}')) {
          buildValidatorMethod(apiFullPath, fieldName, typeText, type);
          results.push(`this.validate${fieldName}(${variable});`);
        } else {
          const unionTypes = type.getUnionTypes();
          if (
            unionTypes.length === 3 &&
            unionTypes.every((a) => a.getText() === 'true' || a.getText() === 'false' || a.getText() === 'undefined')
          ) {
            results.push(
              `if (typeof ${variable} !== 'boolean') throw new ValidationError('${name}', 'mismatch', '${fieldName}');`
            );
          } else if (!type.isBoolean() && unionTypes.length > 0) {
            if (unionTypes.find((b) => b.isEnumLiteral())) {
              const unionConditional: string[] = [];
              for (const unionType of unionTypes) {
                unionConditional.push(`${variable} !== '${(unionType.compilerType as any).value}'`);
              }
              results.push(
                `if (${unionConditional.join('&&')}) throw new ValidationError('${name}', 'mismatch', '${fieldName}');`
              );
            } else {
              const unionConditional: string[] = [];

              if (unionTypes.every((a) => a.getSymbol() && a.getSymbol().getEscapedName() === '__type')) {
                const keyValues = findCommonUnionKey(unionTypes);

                for (const keyValue of keyValues) {
                  const methodName =
                    name + '_' + fieldName + '_' + keyValue.key + '_' + keyValue.value.replace(/["-_ ]/g, '');
                  buildValidatorMethod(
                    apiFullPath,
                    methodName,
                    keyValue.type.getText().replace(apiFullPath, '..'),
                    keyValue.type
                  );
                  unionConditional.push(
                    `(${variable}.${keyValue.key}===${keyValue.value} && this.validate${methodName}(${variable}))`
                  );
                }
                results.push(
                  `if (!(${unionConditional.join(
                    '||'
                  )})) throw new ValidationError('${name}', 'mismatch', '${fieldName}');`
                );
              } else {
                for (const unionType of unionTypes) {
                  const unionTypeText = unionType.getText(null, 1);
                  switch (unionTypeText) {
                    case 'string':
                      unionConditional.push(`typeof ${variable} !== 'string'`);
                      break;
                    case 'string[]':
                      unionConditional.push(`(typeof ${variable} !== 'object' && typeof ${variable}[0] !== 'string')`);
                      break;
                    case 'number[]':
                      unionConditional.push(`(typeof ${variable} !== 'object' && typeof ${variable}[0] !== 'number')`);
                      break;
                    case 'number':
                      unionConditional.push(`typeof ${variable} !== 'number'`);
                      break;
                    case 'boolean':
                      unionConditional.push(`typeof ${variable} !== 'boolean'`);
                      break;
                    case 'Date':
                      console.log('date isnt super supported');
                      break;
                    default:
                      if (
                        (unionTypeText.startsWith("'") && unionTypeText.endsWith("'")) ||
                        (unionTypeText.startsWith('"') && unionTypeText.endsWith('"'))
                      ) {
                        unionConditional.push(`${variable}!==${unionTypeText}`);
                      } else {
                        if (unionTypeText !== 'undefined' && unionTypeText !== undefined) {
                          unionConditional.push(`this.validate${unionTypeText}(${variable})`);
                        }
                      }
                      break;
                  }
                }
                results.push(
                  `if (${unionConditional.join(
                    '&&'
                  )}) throw new ValidationError('${name}', 'mismatch', '${fieldName}');`
                );
              }
            }
          } else if (type.getTupleElements().length > 0) {
            let ind = 0;
            for (const tupleElement of type.getTupleElements()) {
              typeText = tupleElement.getText();
              const v = variable + '[' + ind + ']';
              switch (typeText) {
                case 'string':
                  results.push(
                    `if (typeof ${v} !== 'string') throw new ValidationError('${name}', 'mismatch', '${fieldName}');`
                  );
                  break;
                case 'number':
                  results.push(
                    `if (typeof ${v} !== 'number') throw new ValidationError('${name}', 'mismatch', '${fieldName}');`
                  );
                  break;
                case 'boolean':
                  results.push(
                    `if (typeof ${v} !== 'boolean') throw new ValidationError('${name}', 'mismatch', '${fieldName}');`
                  );
                  break;
                case 'Date':
                  console.log('date isnt super supported');
                  break;
                case 'unknown':
                  break;
                case 'any':
                  /*
                          results.push(
                            `if (typeof ${v} !== 'boolean') throw new ValidationError('${name}', 'mismatch', '${fieldName}');`
                          );
          */
                  break;
                default:
                  buildValidatorMethod(apiFullPath, typeText, type.getText().replace(apiFullPath, '..'), type);

                  results.push(`this.validate${typeText}(${v})`);
                  break;
              }
              ind++;
            }
            results.push(
              `if (typeof (${variable} as any)[${ind}] !== 'undefined') throw new ValidationError('${name}', 'mismatch', '${fieldName}');`
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
              case 'Date':
                console.log('date isnt super supported');
                break;
              case 'unknown':
                break;
              case 'any':
                /*
                results.push(
                  `if (typeof ${variable} !== 'boolean') throw new ValidationError('${name}', 'mismatch', '${fieldName}');`
                );
*/
                break;
              default:
                if (
                  (typeText.startsWith("'") && typeText.endsWith("'")) ||
                  (typeText.startsWith('"') && typeText.endsWith('"'))
                ) {
                  `if (${variable}!==${typeText}) throw new ValidationError('${name}', 'mismatch', '${fieldName}');`;
                } else {
                  buildValidatorMethod(apiFullPath, typeText, type.getText().replace(apiFullPath, '..'), type);

                  results.push(`this.validate${typeText}(${variable})`);
                }
                break;
            }
          }
        }
        if (isArray) {
          results.push(`}`);
        }
        if (optional) {
          results.push(`}`);
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

function findCommonUnionKey(unionTypes: Type[]) {
  const firstUnionType = unionTypes[0];
  let key: string;
  for (const property of firstUnionType.getProperties()) {
    if (unionTypes.every((a) => !!a.getProperty(property.getName()))) {
      key = property.getName();
      break;
    }
  }
  if (!key) {
    throw new Error('No common key in union');
  }
  const items: {key: string; value: string; type: Type}[] = [];
  for (const unionType of unionTypes) {
    items.push({
      key,
      value: unionType.getProperty(key).getValueDeclaration().getType().getText(),
      type: unionType,
    });
  }
  return items;
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
