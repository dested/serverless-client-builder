#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const yargs = require("yargs");
const process_1 = require("./process");
const inArg = yargs.argv.in;
const outArg = yargs.argv.out;
if (yargs.argv.syncPackage) {
    const outerPackage = JSON.parse(fs.readFileSync(inArg + 'package.json', { encoding: 'utf8' }));
    const dirs = fs.readdirSync(inArg + '/controllers');
    for (const dir of dirs) {
        if (dir.indexOf('Controller') >= 0) {
            const innerPath = inArg + '/controllers/' + dir + '/' + 'package.json';
            const innerPackage = JSON.parse(fs.readFileSync(innerPath, { encoding: 'utf8' }));
            innerPackage.dependencies = outerPackage.dependencies;
            innerPackage.devDependencies = outerPackage.devDependencies;
            fs.writeFileSync(innerPath, JSON.stringify(innerPackage, null, '  '), {
                encoding: 'utf8',
            });
        }
    }
}
else {
    process_1.processFile(inArg, outArg, yargs.argv.legacyUrl, yargs.argv.micro);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFFQSx5QkFBeUI7QUFDekIsK0JBQStCO0FBQy9CLHVDQUFzQztBQUV0QyxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQVMsQ0FBQztBQUNuQyxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQVUsQ0FBQztBQUNyQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFO0lBQzFCLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxLQUFLLEdBQUcsY0FBYyxFQUFFLEVBQUMsUUFBUSxFQUFFLE1BQU0sRUFBQyxDQUFDLENBQUMsQ0FBQztJQUM3RixNQUFNLElBQUksR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLEtBQUssR0FBRyxjQUFjLENBQUMsQ0FBQztJQUNwRCxLQUFLLE1BQU0sR0FBRyxJQUFJLElBQUksRUFBRTtRQUN0QixJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ2xDLE1BQU0sU0FBUyxHQUFHLEtBQUssR0FBRyxlQUFlLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxjQUFjLENBQUM7WUFDdkUsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRSxFQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUMsQ0FBQyxDQUFDLENBQUM7WUFDaEYsWUFBWSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUMsWUFBWSxDQUFDO1lBQ3RELFlBQVksQ0FBQyxlQUFlLEdBQUcsWUFBWSxDQUFDLGVBQWUsQ0FBQztZQUM1RCxFQUFFLENBQUMsYUFBYSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUU7Z0JBQ3BFLFFBQVEsRUFBRSxNQUFNO2FBQ2pCLENBQUMsQ0FBQztTQUNKO0tBQ0Y7Q0FDRjtLQUFNO0lBQ0wscUJBQVcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBZ0IsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQVksQ0FBQyxDQUFDO0NBQ2xGIn0=