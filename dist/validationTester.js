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
        .map(a => {
        const fieldName = a.getName();
        // console.log(name, fieldName);
        let type = a.getDeclarations()[0].getType();
        let typeText = type.getText(null, 1);
        const results = [];
        let optional = false;
        if (a.getValueDeclaration().getQuestionTokenNode()) {
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
            if (!type.isBoolean() && type.getUnionTypes().length > 0) {
                if (type.getUnionTypes().find(b => b.isEnumLiteral())) {
                    const unionConditional = [];
                    for (const unionType of type.getUnionTypes()) {
                        unionConditional.push(`${variable} !== '${unionType.compilerType.value}'`);
                    }
                    results.push(`if (${unionConditional.join('&&')}) throw new ValidationError('${name}', 'mismatch', '${fieldName}');`);
                }
                else {
                    const unionConditional = [];
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
                            case 'Date':
                                console.log('date isnt super supported');
                                break;
                            default:
                                if ((unionType.getText(null, 1).startsWith("'") && unionType.getText(null, 1).endsWith("'")) ||
                                    (unionType.getText(null, 1).startsWith('"') && unionType.getText(null, 1).endsWith('"'))) {
                                    unionConditional.push(`${variable}!==${unionType.getText(null, 1)}`);
                                }
                                else {
                                    unionConditional.push(`this.${unionType.getText(null, 1)}Validator(${variable})`);
                                }
                                break;
                        }
                    }
                    results.push(`if (${unionConditional.join('&&')}) throw new ValidationError('${name}', 'mismatch', '${fieldName}');`);
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
                        buildValidatorMethod(apiFullPath, typeText, type.getText().replace(apiFullPath, '..'), type);
                        results.push(`this.validate${typeText}(${variable})`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdGlvblRlc3Rlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3ZhbGlkYXRpb25UZXN0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFFYSxRQUFBLGlCQUFpQixHQUFhLEVBQUUsQ0FBQztBQUU5QyxNQUFNLFdBQVcsR0FBYSxFQUFFLENBQUM7QUFDakMsU0FBZ0Isb0JBQW9CLENBQUMsV0FBbUIsRUFBRSxJQUFZLEVBQUUsUUFBZ0IsRUFBRSxNQUFxQjtJQUM3RyxJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDLEVBQUU7UUFDckMsT0FBTztLQUNSO0lBQ0QsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUV2QixxQkFBcUI7SUFDckIsTUFBTSxNQUFNLEdBQUc7bUJBQ0UsSUFBSSxXQUFXLFFBQVE7OzttQ0FHUCxJQUFJOzttQ0FFSixJQUFJOztNQUVqQyxNQUFNO1NBQ0wsYUFBYSxFQUFFO1NBQ2YsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFO1FBQ1AsTUFBTSxTQUFTLEdBQUcsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQzlCLGdDQUFnQztRQUNoQyxJQUFJLElBQUksR0FBRyxDQUFDLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDNUMsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDckMsTUFBTSxPQUFPLEdBQWEsRUFBRSxDQUFDO1FBQzdCLElBQUksUUFBUSxHQUFHLEtBQUssQ0FBQztRQUNyQixJQUFLLENBQUMsQ0FBQyxtQkFBbUIsRUFBVSxDQUFDLG9CQUFvQixFQUFFLEVBQUU7WUFDM0QsUUFBUSxHQUFHLElBQUksQ0FBQztTQUNqQjtRQUVELElBQUksUUFBUSxHQUFHLFNBQVMsU0FBUyxFQUFFLENB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