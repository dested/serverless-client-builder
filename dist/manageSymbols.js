"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageSymbols = void 0;
const ts_morph_1 = require("ts-morph");
class ManageSymbols {
    constructor() {
        this.types = new Set();
    }
    addSymbol(type, topLevel) {
        var _a;
        const text = type.getType().getText(undefined, ts_morph_1.TypeFormatFlags.NoTruncation);
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
            return '';
        if (text === 'T[]')
            return '';
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
                    const symbol = (_a = foundType.getSymbol()) !== null && _a !== void 0 ? _a : foundType.getAliasSymbol();
                    if (symbol && symbol.getDeclarations()[0]) {
                        this.addSymbol(symbol.getDeclarations()[0], false);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlU3ltYm9scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL21hbmFnZVN5bWJvbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsdUNBQWlFO0FBRWpFLE1BQWEsYUFBYTtJQUExQjtRQUNFLFVBQUssR0FBRyxJQUFJLEdBQUcsRUFBUSxDQUFDO0lBNEMxQixDQUFDO0lBMUNDLFNBQVMsQ0FBQyxJQUFVLEVBQUUsUUFBaUI7O1FBQ3JDLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLDBCQUFlLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDN0UsSUFBSSxJQUFJLEtBQUssS0FBSztZQUFFLE9BQU87UUFDM0IsSUFBSSxJQUFJLEtBQUssTUFBTTtZQUFFLE9BQU87UUFDNUIsSUFBSSxJQUFJLEtBQUssVUFBVTtZQUFFLE9BQU87UUFDaEMsSUFBSSxJQUFJLEtBQUssVUFBVTtZQUFFLE9BQU87UUFDaEMsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7WUFBRSxPQUFPO1FBQ3hDLElBQUksSUFBSSxLQUFLLEdBQUc7WUFBRSxPQUFPLEVBQUUsQ0FBQztRQUM1QixJQUFJLElBQUksS0FBSyxLQUFLO1lBQUUsT0FBTyxFQUFFLENBQUM7UUFFOUIsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQzFDLEtBQUssTUFBTSxVQUFVLElBQUksV0FBVyxFQUFFO1lBQ3BDLElBQUksU0FBUyxDQUFDO1lBQ2QsSUFBSSxxQkFBVSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsSUFBSSxxQkFBVSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsRUFBRTtnQkFDN0UsU0FBUyxHQUFHLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQzthQUNsQztpQkFBTSxJQUFJLHFCQUFVLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDLEVBQUU7Z0JBQ25ELFNBQVMsR0FBRyxVQUFVLENBQUMsYUFBYSxFQUFFLENBQUM7YUFDeEM7WUFDRCxJQUFJLFNBQVMsRUFBRTtnQkFDYixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUU7b0JBQzlCLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO29CQUMxQixNQUFNLE1BQU0sR0FBRyxNQUFBLFNBQVMsQ0FBQyxTQUFTLEVBQUUsbUNBQUksU0FBUyxDQUFDLGNBQWMsRUFBRSxDQUFDO29CQUNuRSxJQUFJLE1BQU0sSUFBSSxNQUFNLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUU7d0JBQ3pDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO3FCQUNwRDtpQkFDRjthQUNGO1NBQ0Y7SUFDSCxDQUFDO0lBRUQsU0FBUztRQUNQLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUMxRSxDQUFDO0lBRU8saUJBQWlCLENBQUMsTUFBWSxFQUFFLFlBQXFCLElBQUk7O1FBQy9ELElBQUksR0FBRyxHQUFHLE1BQUEsQ0FBQyxNQUFBLE1BQU0sQ0FBQyxTQUFTLEVBQUUsbUNBQUksTUFBTSxDQUFDLGNBQWMsRUFBRSxDQUFDLDBDQUFFLGVBQWUsR0FBRyxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUM7UUFDMUYsSUFBSSxDQUFDLEdBQUc7WUFBRSxPQUFPLEVBQUUsQ0FBQztRQUNwQixJQUFJLFNBQVMsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFO1lBQzdDLEdBQUcsR0FBRyxTQUFTLEdBQUcsR0FBRyxDQUFDO1NBQ3ZCO1FBQ0QsT0FBTyxHQUFHLENBQUM7SUFDYixDQUFDO0NBQ0Y7QUE3Q0Qsc0NBNkNDIn0=