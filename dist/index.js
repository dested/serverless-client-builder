#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const yargs = require("yargs");
const process_1 = require("./process");
const inArg = yargs.argv.in;
const outArg = yargs.argv.out.split(',');
process_1.processFile(inArg, outArg, !!yargs.argv.noValidation, !!yargs.argv.noYaml, !!yargs.argv.templateV2, yargs.argv.openApi);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFHQSwrQkFBK0I7QUFDL0IsdUNBQXNDO0FBRXRDLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBUyxDQUFDO0FBQ25DLE1BQU0sTUFBTSxHQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBVyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUVsRCxxQkFBVyxDQUNULEtBQUssRUFDTCxNQUFNLEVBQ04sQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUN6QixDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQ25CLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFDdkIsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFpQixDQUM3QixDQUFDIn0=