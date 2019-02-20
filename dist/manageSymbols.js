"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ManageSymbols {
    constructor() {
        this.symbols = [];
    }
    addSymbol(type) {
        if (type.intrinsicName === 'void') {
            return;
        }
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
        if (symbol.getDeclaredType()) {
            if (symbol.getDeclaredType().isEnumLiteral()) {
                if (symbol.getName() !== 'EventCategory') {
                    return;
                }
            }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlU3ltYm9scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL21hbmFnZVN5bWJvbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFFQSxNQUFhLGFBQWE7SUFBMUI7UUFDRSxZQUFPLEdBQWdCLEVBQUUsQ0FBQztJQW9HNUIsQ0FBQztJQWxHQyxTQUFTLENBQUMsSUFBbUI7UUFDM0IsSUFBSyxJQUFZLENBQUMsYUFBYSxLQUFLLE1BQU0sRUFBRTtZQUMxQyxPQUFPO1NBQ1I7UUFDRCxLQUFLLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxFQUFFO1lBQzNDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDbkI7UUFDRCxLQUFLLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUUsRUFBRTtZQUNwQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ25CO1FBRUQsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUN6RCxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQ1gsK0JBQStCO1lBQy9CLE9BQU87U0FDUjtRQUVELElBQUksTUFBTSxDQUFDLGVBQWUsRUFBRSxFQUFFO1lBQzVCLElBQUksTUFBTSxDQUFDLGVBQWUsRUFBRSxDQUFDLGFBQWEsRUFBRSxFQUFFO2dCQUM1QyxJQUFJLE1BQU0sQ0FBQyxPQUFPLEVBQUUsS0FBSyxlQUFlLEVBQUU7b0JBQ3hDLE9BQU87aUJBQ1I7YUFDRjtTQUNGO1FBRUQsSUFBSSxNQUFNLENBQUMsT0FBTyxFQUFFLEtBQUssUUFBUSxFQUFFO1lBQ2pDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxNQUFNLENBQUMsY0FBYyxDQUFDLEVBQUU7Z0JBQ3hELElBQUksQ0FBQyxPQUFP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