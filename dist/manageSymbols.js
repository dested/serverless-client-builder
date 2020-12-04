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
        if (type.isArray()) {
            const typeArgument = type.getTypeArguments()[0];
            this.addSymbol(typeArgument, topLevel);
            return;
        }
        const symbol = (_a = type.getAliasSymbol(), (_a !== null && _a !== void 0 ? _a : type.getSymbol()));
        if (type.getTypeArguments().length > 0) {
            for (const typeArgument of type.getTypeArguments()) {
                this.addSymbol(typeArgument, true);
            }
        }
        const simpleText = type.getText();
        if (simpleText === 'Date') {
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
        if (!symbol) {
            // console.log(type.getText());
            return;
        }
        if (symbol.getName() === 'ObjectID' || symbol.getName() === 'ObjectId') {
            return;
        }
        if (symbol.getName() === 'T') {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlU3ltYm9scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL21hbmFnZVN5bWJvbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFHQSxNQUFhLGFBQWE7SUFBMUI7UUFDRSxZQUFPLEdBQWdCLEVBQUUsQ0FBQztRQUMxQixnQkFBVyxHQUFvQixFQUFFLENBQUM7UUFDbEMsVUFBSyxHQUFvQixFQUFFLENBQUM7SUFpTTlCLENBQUM7SUEvTEMsU0FBUyxDQUFDLElBQW1CLEVBQUUsUUFBaUI7O1FBQzlDLElBQUssSUFBSSxDQUFDLFlBQW9CLENBQUMsYUFBYSxLQUFLLE1BQU0sRUFBRTtZQUN2RCxPQUFPO1NBQ1I7UUFDRCxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRTtZQUNsQixNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNoRCxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxRQUFRLENBQUMsQ0FBQztZQUN2QyxPQUFPO1NBQ1I7UUFFRCxNQUFNLE1BQU0sU0FBRyxJQUFJLENBQUMsY0FBYyxFQUFFLHVDQUFJLElBQUksQ0FBQyxTQUFTLEVBQUUsRUFBQSxDQUFDO1FBQ3pELElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUN0QyxLQUFLLE1BQU0sWUFBWSxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxFQUFFO2dCQUNsRCxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQzthQUNwQztTQUNGO1FBQ0QsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2xDLElBQUksVUFBVSxLQUFLLE1BQU0sRUFBRTtZQUN6QixPQUFPO1NBQ1I7UUFDRCxLQUFLLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxFQUFFO1lBQzNDLElBQUks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