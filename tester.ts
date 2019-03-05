import * as fs from 'fs';
import Project, {SourceFile} from 'ts-simple-ast';
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

const tests = fs.readdirSync('./tests');
const harness = new Harness();
for (const test of tests) {
  const source = harness.start(`./tests/${test}`);
  const symbolManager = new ManageSymbols();
  symbolManager.addSymbol(source.getExportedDeclarations()[0].getType(), true);
  if (harness.equal(source, symbolManager)) {
    console.log(`${test} Passed`);
  } else {
    console.log(`${test} Failed`);
  }
  break;
}


