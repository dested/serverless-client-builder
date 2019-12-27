"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ManageSymbols {
    constructor() {
        this.symbols = [];
        this.symbolTypes = [];
        this.types = [];
    }
    addSymbol(type, topLevel) {
        if (type.compilerType.intrinsicName === 'void') {
            return;
        }
        for (const t of type.getIntersectionTypes()) {
            this.addSymbol(t, false);
        }
        for (const t of type.getUnionTypes()) {
            if (t.isEnumLiteral()) {
                continue;
            }
            this.addSymbol(t, false);
        }
        const symbol = type.getSymbol() || type.getAliasSymbol();
        if (!symbol) {
            // console.log(type.getText());
            return;
        }
        if (symbol.getName() === 'ObjectID' || symbol.getName() === 'ObjectId') {
            return;
        }
        if (symbol.getName() !== '__type') {
            if (!this.symbols.find(a => a === symbol.compilerSymbol)) {
                this.symbols.push(symbol.compilerSymbol);
                this.symbolTypes.push(type);
                if (topLevel) {
                    this.types.push(type);
                }
            }
            else {
                return;
            }
        }
        const baseTypes = type.getBaseTypes();
        if (baseTypes.length > 0) {
            for (const baseType of baseTypes) {
                // console.log('1', baseType);
                this.addSymbol(baseType, false);
            }
        }
        for (const declaration of symbol.getDeclarations()) {
            for (const t of declaration.getType().getIntersectionTypes()) {
                this.addSymbol(t, false);
            }
            for (const t of declaration.getType().getUnionTypes()) {
                if (t.isEnumLiteral()) {
                    continue;
                }
                this.addSymbol(t, false);
            }
        }
        for (const member of symbol.getMembers()) {
            // console.log(symbol.getName() + ' ' + member.getName());
            const memberType = member.getDeclarations()[0].getType();
            if (memberType.isArray()) {
                const typeArgument = memberType.getTypeArguments()[0];
                switch (typeArgument.getSymbol() && typeArgument.getSymbol().getEscapedName()) {
                    case 'any':
                    case 'string':
                    case 'Date':
                    case 'boolean':
                    case 'number':
                        break;
                    default:
                        const symbol1 = typeArgument;
                        if (symbol1) {
                            this.addSymbol(symbol1, false);
                        }
                        break;
                }
            }
            else {
                switch (memberType.getSymbol() && memberType.getSymbol().getEscapedName()) {
                    case 'any':
                    case 'string':
                    case 'Date':
                    case 'boolean':
                    case 'number':
                        break;
                    default:
                        this.addSymbol(memberType, false);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlU3ltYm9scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL21hbmFnZVN5bWJvbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFFQSxNQUFhLGFBQWE7SUFBMUI7UUFDRSxZQUFPLEdBQWdCLEVBQUUsQ0FBQztRQUMxQixnQkFBVyxHQUFvQixFQUFFLENBQUM7UUFDbEMsVUFBSyxHQUFvQixFQUFFLENBQUM7SUE2RzlCLENBQUM7SUEzR0MsU0FBUyxDQUFDLElBQW1CLEVBQUUsUUFBaUI7UUFDOUMsSUFBSyxJQUFJLENBQUMsWUFBb0IsQ0FBQyxhQUFhLEtBQUssTUFBTSxFQUFFO1lBQ3ZELE9BQU87U0FDUjtRQUNELEtBQUssTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLG9CQUFvQixFQUFFLEVBQUU7WUFDM0MsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7U0FDMUI7UUFDRCxLQUFLLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUUsRUFBRTtZQUNwQyxJQUFJLENBQUMsQ0FBQyxhQUFhLEVBQUUsRUFBRTtnQkFDckIsU0FBUzthQUNWO1lBQ0QsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7U0FDMUI7UUFFRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ3pELElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDWCwrQkFBK0I7WUFDL0IsT0FBTztTQUNSO1FBQ0QsSUFBSSxNQUFNLENBQUMsT0FBTyxFQUFFLEtBQUssVUFBVSxJQUFJLE1BQU0sQ0FBQyxPQUFPLEVBQUUsS0FBSyxVQUFVLEVBQUU7WUFDdEUsT0FBTztTQUNSO1FBRUQsSUFBSSxNQUFNLENBQUMsT0FBTyxFQUFFLEtBQUssUUFBUSxFQUFFO1lBQ2pDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxNQUFNLENBQUMsY0FBYyxDQUFDLEVBQUU7Z0JBQ3hELElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQztnQkFDekMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzVCLElBQUksUUFBUSxFQUFFO29CQUNaLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2lCQUN2QjthQUNGO2lCQUFNO2dCQUNMLE9BQU87YUFDUjtTQUNGO1FBRUQsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBRXRDLElBQUksU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDeEIsS0FBSyxNQUFNLFFBQVEsSUFBSSxTQUFTLEVBQUU7Z0JBQ2hDLDhCQUE4QjtnQkFDOUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7YUFDakM7U0FDRjtRQUVELEtBQUssTUFBTSxXQUFXLElBQUksTUFBTSxDQUFDLGVBQWUsRUFBRSxFQUFFO1lBQ2xELEtBQUssTUFBTSxDQUFDLElBQUksV0FBVyxDQUFDLE9BQU8sRUFBRSxDQUFDLG9CQUFvQixFQUFFLEVBQUU7Z0JBQzVELElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO2FBQzFCO1lBQ0QsS0FBSyxNQUFNLENBQUMsSUFBSSxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUMsYUFBYSxFQUFFLEVBQUU7Z0JBQ3JELElBQUksQ0FBQyxDQUFDLGFBQWEsRUFBRSxFQUFFO29CQUNyQixTQUFTO2lCQUNWO2dCQUNELElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO2FBQzFCO1NBQ0Y7UUFFRCxLQUFLLE1BQU0sTUFBTSxJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUUsRUFBRTtZQUN4QywwREFBMEQ7WUFDMUQsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3pELElBQUksVUFBVSxDQUFDLE9BQU8sRUFBRSxFQUFFO2dCQUN4QixNQUFNLFlBQVksR0FBRyxVQUFVLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFFdEQsUUFBUSxZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksWUFBWSxDQUFDLFNBQVMsRUFBRSxDQUFDLGNBQWMsRUFBRSxFQUFFO29CQUM3RSxLQUFLLEtBQUssQ0FBQztvQkFDWCxLQUFLLFFBQVEsQ0FBQztvQkFDZCxLQUFLLE1BQU0sQ0FBQztvQkFDWixLQUFLLFNBQVMsQ0FBQztvQkFDZixLQUFLLFFBQVE7d0JBQ1gsTUFBTTtvQkFDUjt3QkFDRSxNQUFNLE9BQU8sR0FBRyxZQUFZLENBQUM7d0JBQzdCLElBQUksT0FBTyxFQUFFOzRCQUNYLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO3lCQUNoQzt3QkFDRCxNQUFNO2lCQUNUO2FBQ0Y7aUJBQU07Z0JBQ0wsUUFBUSxVQUFVLENBQUMsU0FBUyxFQUFFLElBQUksVUFBVSxDQUFDLFNBQVMsRUFBRSxDQUFDLGNBQWMsRUFBRSxFQUFFO29CQUN6RSxLQUFLLEtBQUssQ0FBQztvQkFDWCxLQUFLLFFBQVEsQ0FBQztvQkFDZCxLQUFLLE1BQU0sQ0FBQztvQkFDWixLQUFLLFNBQVMsQ0FBQztvQkFDZixLQUFLLFFBQVE7d0JBQ1gsTUFBTTtvQkFDUjt3QkFDRSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsQ0FBQzt3QkFDbEMsTUFBTTtpQkFDVDthQUNGO1NBQ0Y7SUFDSCxDQUFDO0lBRUQsU0FBUztRQUNQLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDckUsQ0FBQztJQUVPLGlCQUFpQixDQUFDLE1BQWlCLEVBQUUsWUFBcUIsSUFBSTtRQUNwRSxPQUFPLE1BQU0sQ0FBQyxZQUFZO2FBQ3ZCLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUNQLElBQUksR0FBRyxHQUFHLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN0QixJQUFJLFNBQVMsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFO2dCQUM3QyxHQUFHLEdBQUcsU0FBUyxHQUFHLEdBQUcsQ0FBQzthQUN2QjtZQUNELE9BQU8sR0FBRyxDQUFDO1FBQ2IsQ0FBQyxDQUFDO2FBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2hCLENBQUM7Q0FDRjtBQWhIRCxzQ0FnSEMifQ==