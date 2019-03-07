#!/usr/bin/env node

import * as fs from 'fs';
import * as yargs from 'yargs';
import {processFile} from './process';

const inArg = yargs.argv.in as any;
const outArg = (yargs.argv.out as any).split(',');
if (yargs.argv.syncPackage) {
  const outerPackage = JSON.parse(fs.readFileSync(inArg + 'package.json', {encoding: 'utf8'}));
  const dirs = fs.readdirSync(inArg + '/controllers');
  for (const dir of dirs) {
    if (dir.indexOf('Controller') >= 0) {
      const innerPath = inArg + '/controllers/' + dir + '/' + 'package.json';
      const innerPackage = JSON.parse(fs.readFileSync(innerPath, {encoding: 'utf8'}));
      innerPackage.dependencies = outerPackage.dependencies;
      innerPackage.devDependencies = outerPackage.devDependencies;
      fs.writeFileSync(innerPath, JSON.stringify(innerPackage, null, '  '), {
        encoding: 'utf8',
      });
    }
  }
} else {
  processFile(inArg, outArg, yargs.argv.legacyUrl as any, yargs.argv.micro as any);
}
