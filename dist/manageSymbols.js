"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ManageSymbols {
    constructor() {
        this.symbols = [];
    }
    addSymbol(type) {
        for (const t of type.getIntersectionTypes()) {
            this.addSymbol(t);
        }
        for (const t of type.getUnionTypes()) {
            this.addSymbol(t);
        }
        const symbol = type.getSymbol() || type.getAliasSymbol();
        if (!symbol) {
            // console.log(type.getText());
            return;
        }
        if (symbol.getName() !== '__type') {
            if (!this.symbols.find(a => a === symbol.compilerSymbol)) {
                this.symbols.push(symbol.compilerSymbol);
            }
        }
        const baseTypes = type.getBaseTypes();
        if (baseTypes.length > 0) {
            for (const baseType of baseTypes) {
                // console.log('1', baseType);
                this.addSymbol(baseType);
            }
        }
        for (const declaration of symbol.getDeclarations()) {
            for (const t of declaration.getType().getIntersectionTypes()) {
                this.addSymbol(t);
            }
            for (const t of declaration.getType().getUnionTypes()) {
                this.addSymbol(t);
            }
        }
        for (const member of symbol.getMembers()) {
            // console.log(symbol.getName() + ' ' + member.getName());
            const memberType = member.getDeclarations()[0].getType();
            if (memberType.isArray()) {
                switch (memberType.getTypeArguments()[0].getText()) {
                    case 'any':
                    case 'string':
                    case 'Date':
                    case 'boolean':
                    case 'number':
                        break;
                    default:
                        const symbol1 = memberType.getTypeArguments()[0];
                        if (symbol1) {
                            this.addSymbol(symbol1);
                        }
                        break;
                }
            }
            else {
                switch (memberType.getText()) {
                    case 'any':
                    case 'string':
                    case 'Date':
                    case 'boolean':
                    case 'number':
                        break;
                    default:
                        this.addSymbol(memberType);
                        break;
                }
            }
        }
    }
    getSource() {
        return this.symbols.map(a => this.getSourceInternal(a)).join('\n');
    }
    getSourceInternal(symbol, addExport = true) {
        return symbol.declarations
            .map(a => {
            let str = a.getText();
            if (addExport && str.indexOf('export') === -1) {
                str = 'export ' + str;
            }
            return str;
        })
            .join('\n');
    }
}
exports.ManageSymbols = ManageSymbols;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlU3ltYm9scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL21hbmFnZVN5bWJvbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFFQSxNQUFhLGFBQWE7SUFBMUI7UUFDRSxZQUFPLEdBQWdCLEVBQUUsQ0FBQztJQXlGNUIsQ0FBQztJQXZGQyxTQUFTLENBQUMsSUFBbUI7UUFDM0IsS0FBSyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsb0JBQW9CLEVBQUUsRUFBRTtZQUMzQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ25CO1FBQ0QsS0FBSyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsYUFBYSxFQUFFLEVBQUU7WUFDcEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUNuQjtRQUVELE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7UUFDekQsSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUNYLCtCQUErQjtZQUMvQixPQUFPO1NBQ1I7UUFFRCxJQUFJLE1BQU0sQ0FBQyxPQUFPLEVBQUUsS0FBSyxRQUFRLEVBQUU7WUFDakMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLE1BQU0sQ0FBQyxjQUFjLENBQUMsRUFBRTtnQkFDeEQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDO2FBQzFDO1NBQ0Y7UUFFRCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFFdEMsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUN4QixLQUFLLE1BQU0sUUFBUSxJQUFJLFNBQVMsRUFBRTtnQkFDaEMsOEJBQThCO2dCQUM5QixJQUFJLENBQUMsU0FBUyxDQUFDLFFB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