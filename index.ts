#!/usr/bin/env node

import * as fs from 'fs';
import * as yargs from 'yargs';
import {processFile} from './process';

const inArg = yargs.argv.in as any;
const outArg = (yargs.argv.out as any).split(',');

processFile(
  inArg,
  outArg,
  !!yargs.argv.noValidation,
  !!yargs.argv.noYaml,
  !!yargs.argv.templateV2,
  yargs.argv.openApi as string
);
