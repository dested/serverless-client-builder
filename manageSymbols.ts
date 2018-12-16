import {ts, Type} from 'ts-simple-ast';

export class ManageSymbols {
  symbols: ts.Symbol[] = [];

  addSymbol(type: Type<ts.Type>) {
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
      } else {
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
