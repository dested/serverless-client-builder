"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildValidatorMethod = exports.validationMethods = void 0;
exports.validationMethods = [];
const methodNames = [];
function buildValidatorMethod(apiFullPath, name, fullType, symbol) {
    if (name === 'ObjectId' || name === 'ObjectID') {
        exports.validationMethods.push(`static validate${name}(model: any):boolean {
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
        var _a, _b;
        const fieldName = property.getName();
        // console.log(name, fieldName);
        let type = property.getDeclarations()[0].getType();
        if (type.isUnion() && type.getUnionTypes().length === 2 && type.getUnionTypes()[0].isUndefined()) {
            type = type.getUnionTypes()[1];
        }
        let typeText = type.getText(null, 1);
        const results = [];
        let optional = false;
        if (property.getValueDeclaration() && ((_b = (_a = property.getValueDeclaration()).getQuestionTokenNode) === null || _b === void 0 ? void 0 : _b.call(_a))) {
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
        }
        else {
            results.push(`if ('${fieldName}' in model) {`);
            results.push(`fieldCount++;`);
            results.push(`if (model['${fieldName}']!==null && model['${fieldName}']!==undefined) {`);
        }
        if (isArray) {
            results.push(`if (typeof ${variable} !== 'object' || !('length' in ${variable})) throw new ValidationError('${name}', 'mismatch', '${fieldName}');`);
            results.push(`for (let i = 0; i < ${variable}.length; i++) { const ${fieldName}Elem = ${variable}[i];`);
            variable = `${fieldName}Elem`;
            type = type.getArrayElementType();
        }
        if (typeText.startsWith('{') && typeText.endsWith('}')) {
            buildValidatorMethod(apiFullPath, fieldName, typeText, type);
            results.push(`this.validate${fieldName}(${variable});`);
        }
        else {
            const unionTypes = type.getUnionTypes();
            if (unionTypes.length === 3 &&
                unionTypes.every((a) => a.getText() === 'true' || a.getText() === 'false' || a.getText() === 'undefined')) {
                results.push(`if (typeof ${variable} !== 'boolean') throw new ValidationError('${name}', 'mismatch', '${fieldName}');`);
            }
            else if (!type.isBoolean() && unionTypes.length > 0) {
                if (unionTypes.find((b) => b.isEnumLiteral())) {
                    const unionConditional = [];
                    for (const unionType of unionTypes) {
                        unionConditional.push(`${variable} !== '${unionType.compilerType.value}'`);
                    }
                    results.push(`if (${unionConditional.join('&&')}) throw new ValidationError('${name}', 'mismatch', '${fieldName}');`);
                }
                else {
                    const unionConditional = [];
                    if (unionTypes.every((a) => a.getSymbol() && a.getSymbol().getEscapedName() === '__type')) {
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
                                    if ((unionTypeText.startsWith("'") && unionTypeText.endsWith("'")) ||
                                        (unionTypeText.startsWith('"') && unionTypeText.endsWith('"'))) {
                                        unionConditional.push(`${variable}!==${unionTypeText}`);
                                    }
                                    else {
                                        if (unionTypeText !== 'undefined' && unionTypeText !== undefined) {
                                            unionConditional.push(`this.validate${unionTypeText}(${variable})`);
                                        }
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
        if (unionTypes.every((a) => !!a.getProperty(property.getName()))) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdGlvblRlc3Rlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3ZhbGlkYXRpb25UZXN0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBRWEsUUFBQSxpQkFBaUIsR0FBYSxFQUFFLENBQUM7QUFFOUMsTUFBTSxXQUFXLEdBQWEsRUFBRSxDQUFDO0FBRWpDLFNBQWdCLG9CQUFvQixDQUFDLFdBQW1CLEVBQUUsSUFBWSxFQUFFLFFBQWdCLEVBQUUsTUFBWTtJQUNwRyxJQUFJLElBQUksS0FBSyxVQUFVLElBQUksSUFBSSxLQUFLLFVBQVUsRUFBRTtRQUM5Qyx5QkFBaUIsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLElBQUk7OztNQUczQyxDQUFDLENBQUM7UUFDSixPQUFPO0tBQ1I7SUFFRCxJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsRUFBRTtRQUN2QyxPQUFPO0tBQ1I7SUFDRCxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRXZCLHFCQUFxQjtJQUNyQixNQUFNLE1BQU0sR0FBRzttQkFDRSxJQUFJLFdBQVcsUUFBUTs7O21DQUdQLElBQUk7O21DQUVKLElBQUk7O01BRWpDLE1BQU07U0FDTCxhQUFhLEVBQUU7U0FDZixHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBRTs7UUFDaEIsTUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3JDLGdDQUFnQztRQUNoQyxJQUFJLElBQUksR0FBRyxRQUFRLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDbkQsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUMsQ0FBQyxD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