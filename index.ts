#!/usr/bin/env node

import * as yargs from 'yargs';
import {processFile} from './process';

processFile(yargs.argv.in, yargs.argv.out, yargs.argv.legacyUrl);
