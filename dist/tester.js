"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const ts_simple_ast_1 = require("ts-simple-ast");
const manageSymbols_1 = require("./manageSymbols");
class Harness {
    start(path) {
        const project = new ts_simple_ast_1.default({ tsConfigFilePath: './tsconfig.json' });
        return project.getSourceFile(path);
    }
    equal(source, symbolManager) {
        const left = source.getFullText().replace(/\s/g, '');
        const right = symbolManager.getSource().replace(/\s/g, '');
        if (left !== right) {
            console.log(source.getFullText());
            console.log('--------');
            console.log(symbolManager.getSource());
        }
        return left === right;
    }
}
exports.Harness = Harness;
const tests = fs.readdirSync('./tests');
const harness = new Harness();
for (const test of tests) {
    const source = harness.start(`./tests/${test}`);
    const symbolManager = new manageSymbols_1.ManageSymbols();
    symbolManager.addSymbol(source.getExportedDeclarations()[0].getType());
    if (harness.equal(source, symbolManager)) {
        console.log(`${test} Passed`);
    }
    else {
        console.log(`${test} Failed`);
    }
    break;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vdGVzdGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEseUJBQXlCO0FBQ3pCLGlEQUFrRDtBQUNsRCxtREFBOEM7QUFFOUMsTUFBYSxPQUFPO0lBQ2xCLEtBQUssQ0FBQyxJQUFZO1FBQ2hCLE1BQU0sT0FBTyxHQUFHLElBQUksdUJBQU8sQ0FBQyxFQUFDLGdCQUFnQixFQUFFLGlCQUFpQixFQUFDLENBQUMsQ0FBQztRQUNuRSxPQUFPLE9BQU8sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDckMsQ0FBQztJQUVELEtBQUssQ0FBQyxNQUFrQixFQUFFLGFBQTRCO1FBQ3BELE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ3JELE1BQU0sS0FBSyxHQUFHLGFBQWEsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQzNELElBQUksSUFBSSxLQUFLLEtBQUssRUFBRTtZQUNsQixPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1lBQ2xDLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDeEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQztTQUN4QztRQUNELE9BQU8sSUFBSSxLQUFLLEtBQUssQ0FBQztJQUN4QixDQUFDO0NBQ0Y7QUFoQkQsMEJBZ0JDO0FBRUQsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUN4QyxNQUFNLE9BQU8sR0FBRyxJQUFJLE9BQU8sRUFBRSxDQUFDO0FBQzlCLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFO0lBQ3hCLE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsV0FBVyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ2hELE1BQU0sYUFBYSxHQUFHLElBQUksNkJBQWEsRUFBRSxDQUFDO0lBQzFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLHVCQUF1QixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUN2RSxJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLGFBQWEsQ0FBQyxFQUFFO1FBQ3hDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLFNBQVMsQ0FBQyxDQUFDO0tBQy9CO1NBQU07UUFDTCxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxTQUFTLENBQUMsQ0FBQztLQUMvQjtJQUNELE1BQU07Q0FDUCJ9