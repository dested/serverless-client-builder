#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const yargs = require("yargs");
const process_1 = require("./process");
const inArg = yargs.argv.in;
const outArg = yargs.argv.out.split(',');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFFQSx5QkFBeUI7QUFDekIsK0JBQStCO0FBQy9CLHVDQUFzQztBQUV0QyxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQVMsQ0FBQztBQUNuQyxNQUFNLE1BQU0sR0FBSSxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQVcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDbEQsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRTtJQUMxQixNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsS0FBSyxHQUFHLGNBQWMsRUFBRSxFQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUMsQ0FBQyxDQUFDLENBQUM7SUFDN0YsTUFBTSxJQUFJLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEdBQUcsY0FBYyxDQUFDLENBQUM7SUFDcEQsS0FBSyxNQUFNLEdBQUcsSUFBSSxJQUFJLEVBQUU7UUFDdEIsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNsQyxNQUFNLFNBQVMsR0FBRyxLQUFLLEdBQUcsZUFBZSxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsY0FBYyxDQUFDO1lBQ3ZFLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsRUFBQyxRQUFRLEVBQUUsTUFBTSxFQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2hGLFlBQVksQ0FBQyxZQUFZLEdBQUcsWUFBWSxDQUFDLFlBQVksQ0FBQztZQUN0RCxZQUFZLENBQUMsZUFBZSxHQUFHLFlBQVksQ0FBQyxlQUFlLENBQUM7WUFDNUQsRUFBRSxDQUFDLGFBQWEsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFO2dCQUNwRSxRQUFRLEVBQUUsTUFBTTthQUNqQixDQUFDLENBQUM7U0FDSjtLQUNGO0NBQ0Y7S0FBTTtJQUNMLHFCQUFXLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQWdCLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFZLENBQUMsQ0FBQztDQUNsRiJ9