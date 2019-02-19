#!/usr/bin/env node

import * as yargs from 'yargs';
import {processFile} from './process';

processFile(yargs.argv.in as any, yargs.argv.out as any, yargs.argv.legacyUrl as any, yargs.argv.micro as any);
