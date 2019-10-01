import {ts, Type} from 'ts-simple-ast';

export class ManageSymbols {
  symbols: ts.Symbol[] = [];
  types: Type<ts.Type>[] = [];

  addSymbol(type: Type<ts.Type>, topLevel: boolean) {
    if ((type.compilerType as any).intrinsicName === 'void') {
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
        if (topLevel) {
          this.types.push(type);
        }
      } else {
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
      } else {
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

  private getSourceInternal(symbol: ts.Symbol, addExport: boolean = true) {
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
