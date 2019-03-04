import * as fs from 'fs';
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

function buildValidator(symbolManager: ManageSymbols, symbol: Type<ts.Type>) {
  const name = symbol.getSymbol().getName();
  return `
  static ${name}Validator(model: ${name}):boolean {
    if(model===null)
      throw new ValidationError('${name}', 'missing', '');
    if(typeof model!=='object')
      throw new ValidationError('${name}', 'mismatch', '');
    
    ${symbol
      .getProperties()
      .map(a => {
        const fieldName = a.getName();
        const type = a.getDeclarations()[0].getType();
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
          results.push(`if (${variable} !== null) {`);
        }

        if (isArray) {
          results.push(
            `if (typeof ${variable} !== 'object' || !('length' in ${variable})) throw new ValidationError('${name}', 'mismatch', '${fieldName}');`
          );
          results.push(`for (let i = 0; i < ${variable}.length; i++) { const ${fieldName}Elem = ${variable}[i];`);
          variable = `${fieldName}Elem`;
        }

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
            `if (${unionConditional.join('||')}) throw new ValidationError('${name}', 'mismatch', '${fieldName}');`
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
              results.push(`this.${typeText}Validator(${variable})`);
              break;
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
      
      return true;
      } 
  `;
}

for (const test of tests) {
  const source = harness.start(`./validation-tests/${test}`);
  const symbolManager = new ManageSymbols();
  symbolManager.addSymbol(source.getExportedDeclarations()[0].getType());

  console.log(symbolManager.getSource());
  console.log(symbolManager.types.map(a => buildValidator(symbolManager, a)).join('\r\n'));
}
