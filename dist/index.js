#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const yargs = require("yargs");
const process_1 = require("./process");
// processFile('c:/code/CleverRX/api/', 'c:/code/CleverRX/app/src/dataServices/app.generated.ts');
// processFile('c:/code/double-dates/api2/', 'c:/code/double-dates/app/src/dataServices/app.generated.ts');
process_1.processFile(yargs.argv.in, yargs.argv.out, !!yargs.argv.yml);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFFQSwrQkFBK0I7QUFDL0IsdUNBQXNDO0FBRXRDLGtHQUFrRztBQUNsRywyR0FBMkc7QUFFM0cscUJBQVcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyJ9