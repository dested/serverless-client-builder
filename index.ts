#!/usr/bin/env node

import * as yargs from 'yargs';
import {processFile} from './process';

// processFile('c:/code/CleverRX/api/', 'c:/code/CleverRX/app/src/dataServices/app.generated.ts');
// processFile('c:/code/double-dates/api2/', 'c:/code/double-dates/app/src/dataServices/app.generated.ts');

processFile(yargs.argv.in, yargs.argv.out);
