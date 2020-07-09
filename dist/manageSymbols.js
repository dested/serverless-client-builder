"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ManageSymbols {
    constructor() {
        this.symbols = [];
        this.symbolTypes = [];
        this.types = [];
    }
    addSymbol(type, topLevel) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
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
        const symbol = (_a = type.getAliasSymbol(), (_a !== null && _a !== void 0 ? _a : type.getSymbol()));
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
        const members = [
            ...symbol.getMembers(),
            ...(_d = (_c = (_b = symbol
                .getDeclaredType()) === null || _b === void 0 ? void 0 : _b.getSymbol()) === null || _c === void 0 ? void 0 : _c.getMembers(), (_d !== null && _d !== void 0 ? _d : [])),
        ].filter(a => a);
        for (const member of members) {
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
                if ((_j = (_h = (_g = (_f = (_e = memberType
                    .getSymbol()) === null || _e === void 0 ? void 0 : _e.getMembers()[0]) === null || _f === void 0 ? void 0 : _f.getDeclarations()[0]) === null || _g === void 0 ? void 0 : _g.getSymbol()) === null || _h === void 0 ? void 0 : _h.getDeclarations()[0]) === null || _j === void 0 ? void 0 : _j.getKeyType) {
                    const keyType = memberType
                        .getSymbol()
                        .getMembers()[0]
                        .getDeclarations()[0]
                        .getSymbol()
                        .getDeclarations()[0].getKeyType();
                    const returnType = memberType
                        .getSymbol()
                        .getMembers()[0]
                        .getDeclarations()[0]
                        .getSymbol()
                        .getDeclarations()[0].getReturnType();
                    this.addSymbol(keyType, false);
                    this.addSymbol(returnType, false);
                }
                if (((_l = (_k = memberType
                    .getSymbol()) === null || _k === void 0 ? void 0 : _k.getDeclarations()[0]) === null || _l === void 0 ? void 0 : _l.getKind()) === 179) {
                    const keyType = memberType
                        .getSymbol()
                        .getDeclarations()[0]
                        .getType().compilerType.constraintType.aliasSymbol.escapedName;
                    const returnType = (_m = memberType.getSymbol().getDeclarations()[0].compilerNode.type.typeName) === null || _m === void 0 ? void 0 : _m.escapedText;
                    this.addSymbol(memberType
                        .getSymbol()
                        .getDeclarations()[0]
                        .getSourceFile()
                        .getTypeAlias(keyType)
                        .getType(), false);
                    if (returnType) {
                        this.addSymbol(memberType
                            .getSymbol()
                            .getDeclarations()[0]
                            .getSourceFile()
                            .getTypeAlias(returnType)
                            .getType(), false);
                    }
                }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlU3ltYm9scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL21hbmFnZVN5bWJvbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFHQSxNQUFhLGFBQWE7SUFBMUI7UUFDRSxZQUFPLEdBQWdCLEVBQUUsQ0FBQztRQUMxQixnQkFBVyxHQUFvQixFQUFFLENBQUM7UUFDbEMsVUFBSyxHQUFvQixFQUFFLENBQUM7SUErSzlCLENBQUM7SUE3S0MsU0FBUyxDQUFDLElBQW1CLEVBQUUsUUFBaUI7O1FBQzlDLElBQUssSUFBSSxDQUFDLFlBQW9CLENBQUMsYUFBYSxLQUFLLE1BQU0sRUFBRTtZQUN2RCxPQUFPO1NBQ1I7UUFDRCxLQUFLLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxFQUFFO1lBQzNDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQzFCO1FBQ0QsS0FBSyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsYUFBYSxFQUFFLEVBQUU7WUFDcEMsSUFBSSxDQUFDLENBQUMsYUFBYSxFQUFFLEVBQUU7Z0JBQ3JCLFNBQVM7YUFDVjtZQUNELElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQzFCO1FBRUQsTUFBTSxNQUFNLFNBQUcsSUFBSSxDQUFDLGNBQWMsRUFBRSx1Q0FBSSxJQUFJLENBQUMsU0FBUyxFQUFFLEVBQUEsQ0FBQztRQUN6RCxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQ1gsK0JBQStCO1lBQy9CLE9BQU87U0FDUjtRQUNELElBQUksTUFBTSxDQUFDLE9BQU8sRUFBRSxLQUFLLFVBQVUsSUFBSSxNQUFNLENBQUMsT0FBTyxFQUFFLEtBQUssVUFBVSxFQUFFO1lBQ3RFLE9BQU87U0FDUjtRQUVELElBQUksTUFBTSxDQUFDLE9BQU8sRUFBRSxLQUFLLFFBQVEsRUFBRTtZQUNqQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8s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