"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validationMethods = [];
const methodNames = [];
function buildValidatorMethod(apiFullPath, name, fullType, symbol) {
    if (methodNames.find(a => a === name)) {
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
        .map(property => {
        const fieldName = property.getName();
        // console.log(name, fieldName);
        let type = property.getDeclarations()[0].getType();
        let typeText = type.getText(null, 1);
        const results = [];
        let optional = false;
        if (property.getValueDeclaration() && property.getValueDeclaration().getQuestionTokenNode()) {
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
            results.push(`fieldCount++;`);
        }
        else {
            results.push(`if ('${fieldName}' in model) {`);
            results.push(`fieldCount++;`);
            results.push(`if (model.${fieldName}!==null) {`);
        }
        if (isArray) {
            results.push(`if (typeof ${variable} !== 'object' || !('length' in ${variable})) throw new ValidationError('${name}', 'mismatch', '${fieldName}');`);
            results.push(`for (let i = 0; i < ${variable}.length; i++) { const ${fieldName}Elem = ${variable}[i];`);
            variable = `${fieldName}Elem`;
            type = type.getArrayType();
        }
        if (typeText.startsWith('{') && typeText.endsWith('}')) {
            buildValidatorMethod(apiFullPath, fieldName, typeText, type);
            results.push(`this.validate${fieldName}(${variable});`);
        }
        else {
            const unionTypes = type.getUnionTypes();
            if (!type.isBoolean() && unionTypes.length > 0) {
                if (unionTypes.find(b => b.isEnumLiteral())) {
                    const unionConditional = [];
                    for (const unionType of unionTypes) {
                        unionConditional.push(`${variable} !== '${unionType.compilerType.value}'`);
                    }
                    results.push(`if (${unionConditional.join('&&')}) throw new ValidationError('${name}', 'mismatch', '${fieldName}');`);
                }
                else {
                    const unionConditional = [];
                    if (unionTypes.every(a => a.getSymbol() && a.getSymbol().getEscapedName() === '__type')) {
                        const keyValues = findCommonUnionKey(unionTypes);
                        for (const keyValue of keyValues) {
                            const methodName = name + '_' + fieldName + '_' + keyValue.key + '_' + keyValue.value.replace(/["-_ ]/g, '');
                            buildValidatorMethod(apiFullPath, methodName, keyValue.type.getText().replace(apiFullPath, '..'), keyValue.type);
                            unionConditional.push(`(${variable}.${keyValue.key}===${keyValue.value} && this.validate${methodName}(${variable}))`);
                        }
                        results.push(`if (!(${unionConditional.join('||')})) throw new ValidationError('${name}', 'mismatch', '${fieldName}');`);
                    }
                    else {
                        for (const unionType of unionTypes) {
                            const unionTypeText = unionType.getText(null, 1);
                            switch (unionTypeText) {
                                case 'string':
                                    unionConditional.push(`typeof ${variable} !== 'string'`);
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
                                    if ((unionTypeText.startsWith("'") && unionTypeText.endsWith("'")) ||
                                        (unionTypeText.startsWith('"') && unionTypeText.endsWith('"'))) {
                                        unionConditional.push(`${variable}!==${unionTypeText}`);
                                    }
                                    else {
                                        unionConditional.push(`this.validate${unionTypeText}(${variable})`);
                                    }
                                    break;
                            }
                        }
                        results.push(`if (${unionConditional.join('&&')}) throw new ValidationError('${name}', 'mismatch', '${fieldName}');`);
                    }
                }
            }
            else if (type.getTupleElements().length > 0) {
                let ind = 0;
                for (const tupleElement of type.getTupleElements()) {
                    typeText = tupleElement.getText();
                    const v = variable + '[' + ind + ']';
                    switch (typeText) {
                        case 'string':
                            results.push(`if (typeof ${v} !== 'string') throw new ValidationError('${name}', 'mismatch', '${fieldName}');`);
                            break;
                        case 'number':
                            results.push(`if (typeof ${v} !== 'number') throw new ValidationError('${name}', 'mismatch', '${fieldName}');`);
                            break;
                        case 'boolean':
                            results.push(`if (typeof ${v} !== 'boolean') throw new ValidationError('${name}', 'mismatch', '${fieldName}');`);
                            break;
                        case 'Date':
                            console.log('date isnt super supported');
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
                results.push(`if (typeof (${variable} as any)[${ind}] !== 'undefined') throw new ValidationError('${name}', 'mismatch', '${fieldName}');`);
            }
            else {
                switch (typeText) {
                    case 'string':
                        results.push(`if (typeof ${variable} !== 'string') throw new ValidationError('${name}', 'mismatch', '${fieldName}');`);
                        break;
                    case 'number':
                        results.push(`if (typeof ${variable} !== 'number') throw new ValidationError('${name}', 'mismatch', '${fieldName}');`);
                        break;
                    case 'boolean':
                        results.push(`if (typeof ${variable} !== 'boolean') throw new ValidationError('${name}', 'mismatch', '${fieldName}');`);
                        break;
                    case 'Date':
                        console.log('date isnt super supported');
                        break;
                    case 'any':
                        /*
                        results.push(
                          `if (typeof ${variable} !== 'boolean') throw new ValidationError('${name}', 'mismatch', '${fieldName}');`
                        );
        */
                        break;
                    default:
                        if ((typeText.startsWith("'") && typeText.endsWith("'")) ||
                            (typeText.startsWith('"') && typeText.endsWith('"'))) {
                            `if (${variable}!==${typeText}) throw new ValidationError('${name}', 'mismatch', '${fieldName}');`;
                        }
                        else {
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
    exports.validationMethods.push(method);
}
exports.buildValidatorMethod = buildValidatorMethod;
function findCommonUnionKey(unionTypes) {
    const firstUnionType = unionTypes[0];
    let key;
    for (const property of firstUnionType.getProperties()) {
        if (unionTypes.every(a => !!a.getProperty(property.getName()))) {
            key = property.getName();
            break;
        }
    }
    if (!key) {
        throw new Error('No common key in union');
    }
    const items = [];
    for (const unionType of unionTypes) {
        items.push({
            key,
            value: unionType
                .getProperty(key)
                .getValueDeclaration()
                .getType()
                .getText(),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdGlvblRlc3Rlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3ZhbGlkYXRpb25UZXN0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFFYSxRQUFBLGlCQUFpQixHQUFhLEVBQUUsQ0FBQztBQUU5QyxNQUFNLFdBQVcsR0FBYSxFQUFFLENBQUM7QUFFakMsU0FBZ0Isb0JBQW9CLENBQUMsV0FBbUIsRUFBRSxJQUFZLEVBQUUsUUFBZ0IsRUFBRSxNQUFxQjtJQUM3RyxJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDLEVBQUU7UUFDckMsT0FBTztLQUNSO0lBQ0QsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUV2QixxQkFBcUI7SUFDckIsTUFBTSxNQUFNLEdBQUc7bUJBQ0UsSUFBSSxXQUFXLFFBQVE7OzttQ0FHUCxJQUFJOzttQ0FFSixJQUFJOztNQUVqQyxNQUFNO1NBQ0wsYUFBYSxFQUFFO1NBQ2YsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFO1FBQ2QsTUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3JDLGdDQUFnQztRQUNoQyxJQUFJLElBQUksR0FBRyxRQUFRLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDbkQsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDckMsTUFBTSxPQUFPLEdBQWEsRUFBRSxDQUFDO1FBQzdCLElBQUksUUFBUSxHQUFHLEtBQUssQ0FBQztRQUNyQixJQUFJLFFBQVEsQ0FBQyxtQkFBbUIsRUFBRSxJQUFLLFFBQVEsQ0FBQyxtQkFBbUIsRUFBVSxDQUFDLG9CQUFvQixFQUFFLEVBQUU7WUFDcEcsUUFBUSxHQUFHLElBQUksQ0FBQztTQUNqQjtRQUVELElBQUks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