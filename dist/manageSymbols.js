"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageSymbols = void 0;
const ts_morph_1 = require("ts-morph");
class ManageSymbols {
    constructor() {
        this.types = new Set();
        this.requestTypes = new Set();
    }
    addSymbol(type, topLevel, isRequest) {
        var _a, _b, _c;
        const t = type.getType();
        const text = (_b = ((_a = t.getSymbol()) !== null && _a !== void 0 ? _a : t.getAliasSymbol())) === null || _b === void 0 ? void 0 : _b.getName();
        if (!text) {
            console.log('AN ERROR HAS OCCURRED WHILE TRYING TO GET THE SYMBOL NAME', type.getText());
            return;
        }
        if (text === 'any')
            return;
        if (text === 'Date')
            return;
        if (text === 'ObjectId')
            return;
        if (text === 'ObjectID')
            return;
        if (text.indexOf('Array') === 0)
            return;
        if (text === 'T')
            return;
        if (text === 'T[]')
            return;
        const descendants = type.getDescendants();
        for (const descendant of descendants) {
            let foundType;
            if (ts_morph_1.TypeGuards.isTypedNode(descendant) || ts_morph_1.TypeGuards.isIdentifier(descendant)) {
                foundType = descendant.getType();
            }
            else if (ts_morph_1.TypeGuards.isReturnTypedNode(descendant)) {
                foundType = descendant.getReturnType();
            }
            if (foundType) {
                if (!this.types.has(foundType)) {
                    this.types.add(foundType);
                    if (isRequest) {
                        this.requestTypes.add(foundType);
                    }
                    const symbol = (_c = foundType.getSymbol()) !== null && _c !== void 0 ? _c : foundType.getAliasSymbol();
                    if (symbol && symbol.getDeclarations()[0]) {
                        this.addSymbol(symbol.getDeclarations()[0], false, isRequest);
                    }
                }
            }
        }
    }
    getSource() {
        return [...this.types].map((a) => this.getSourceInternal(a)).join('\n');
    }
    getSourceInternal(symbol, addExport = true) {
        var _a, _b;
        let str = (_b = ((_a = symbol.getSymbol()) !== null && _a !== void 0 ? _a : symbol.getAliasSymbol())) === null || _b === void 0 ? void 0 : _b.getDeclarations()[0].getText();
        if (!str)
            return '';
        if (addExport && str.indexOf('export') === -1) {
            str = 'export ' + str;
        }
        return str;
    }
}
exports.ManageSymbols = ManageSymbols;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlU3ltYm9scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL21hbmFnZVN5bWJvbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsdUNBQWlFO0FBRWpFLE1BQWEsYUFBYTtJQUExQjtRQUNFLFVBQUssR0FBRyxJQUFJLEdBQUcsRUFBUSxDQUFDO1FBQ3hCLGlCQUFZLEdBQUcsSUFBSSxHQUFHLEVBQVEsQ0FBQztJQXFEakMsQ0FBQztJQW5EQyxTQUFTLENBQUMsSUFBVSxFQUFFLFFBQWlCLEVBQUUsU0FBa0I7O1FBQ3pELE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUV6QixNQUFNLElBQUksR0FBRyxNQUFBLENBQUMsTUFBQSxDQUFDLENBQUMsU0FBUyxFQUFFLG1DQUFJLENBQUMsQ0FBQyxjQUFjLEVBQUUsQ0FBQywwQ0FBRSxPQUFPLEVBQUUsQ0FBQztRQUM5RCxJQUFJLENBQUMsSUFBSSxFQUFFO1lBQ1QsT0FBTyxDQUFDLEdBQUcsQ0FBQywyREFBMkQsRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUN6RixPQUFPO1NBQ1I7UUFDRCxJQUFJLElBQUksS0FBSyxLQUFLO1lBQUUsT0FBTztRQUMzQixJQUFJLElBQUksS0FBSyxNQUFNO1lBQUUsT0FBTztRQUM1QixJQUFJLElBQUksS0FBSyxVQUFVO1lBQUUsT0FBTztRQUNoQyxJQUFJLElBQUksS0FBSyxVQUFVO1lBQUUsT0FBTztRQUNoQyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztZQUFFLE9BQU87UUFDeEMsSUFBSSxJQUFJLEtBQUssR0FBRztZQUFFLE9BQU87UUFDekIsSUFBSSxJQUFJLEtBQUssS0FBSztZQUFFLE9BQU87UUFFM0IsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQzFDLEtBQUssTUFBTSxVQUFVLElBQUksV0FBVyxFQUFFO1lBQ3BDLElBQUksU0FBUyxDQUFDO1lBQ2QsSUFBSSxxQkFBVSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsSUFBSSxxQkFBVSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsRUFBRTtnQkFDN0UsU0FBUyxHQUFHLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQzthQUNsQztpQkFBTSxJQUFJLHFCQUFVLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDLEVBQUU7Z0JBQ25ELFNBQVMsR0FBRyxVQUFVLENBQUMsYUFBYSxFQUFFLENBQUM7YUFDeEM7WUFDRCxJQUFJLFNBQVMsRUFBRTtnQkFDYixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUU7b0JBQzlCLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO29CQUMxQixJQUFJLFNBQVMsRUFBRTt3QkFDYixJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztxQkFDbEM7b0JBQ0QsTUFBTSxNQUFNLEdBQUcsTUFBQSxTQUFTLENBQUMsU0FBUyxFQUFFLG1DQUFJLFNBQVMsQ0FBQyxjQUFjLEVBQUUsQ0FBQztvQkFDbkUsSUFBSSxNQUFNLElBQUksTUFBTSxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFO3dCQUN6QyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsU0FBUyxDQUFDLENBQUM7cUJBQy9EO2lCQUNGO2FBQ0Y7U0FDRjtJQUNILENBQUM7SUFFRCxTQUFTO1FBQ1AsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzFFLENBQUM7SUFFTyxpQkFBaUIsQ0FBQyxNQUFZLEVBQUUsWUFBcUIsSUFBSTs7UUFDL0QsSUFBSSxHQUFHLEdBQUcsTUFBQSxDQUFDLE1BQUEsTUFBTSxDQUFDLFNBQVMsRUFBRSxtQ0FBSSxNQUFNLENBQUMsY0FBYyxFQUFFLENBQUMsMENBQUUsZUFBZSxHQUFHLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQztRQUMxRixJQUFJLENBQUMsR0FBRztZQUFFLE9BQU8sRUFBRSxDQUFDO1FBQ3BCLElBQUksU0FBUyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7WUFDN0MsR0FBRyxHQUFHLFNBQVMsR0FBRyxHQUFHLENBQUM7U0FDdkI7UUFDRCxPQUFPLEdBQUcsQ0FBQztJQUNiLENBQUM7Q0FDRjtBQXZERCxzQ0F1REMifQ==