#!/usr/bin/env node

import * as fs from 'fs';
import * as yargs from 'yargs';
import {processFile} from './process';

const inArg = yargs.argv.in as any;
const outArg = (yargs.argv.out as any).split(',');

processFile(inArg, outArg);
