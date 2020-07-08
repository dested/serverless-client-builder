import {IndexSignatureDeclaration, ts, Type, TypeNode, TypeParameterDeclaration} from 'ts-simple-ast';
import MappedTypeNode = ts.MappedTypeNode;

export class ManageSymbols {
  symbols: ts.Symbol[] = [];
  symbolTypes: Type<ts.Type>[] = [];
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

    const symbol = type.getAliasSymbol() ?? type.getSymbol();
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

    const members = [
      ...symbol.getMembers(),
      ...(symbol
        .getDeclaredType()
        ?.getSymbol()
        ?.getMembers() ?? []),
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
      } else {
        if (member.getName() === 'subscriber_badges') {
          debugger;
          console.log(memberType.getSymbol().getMembers());
        }
        if (
          (memberType
            .getSymbol()
            ?.getMembers()[0]
            ?.getDeclarations()[0]
            ?.getSymbol()
            ?.getDeclarations()[0] as any)?.getKeyType
        ) {
          const keyType = (memberType
            .getSymbol()
            .getMembers()[0]
            .getDeclarations()[0]
            .getSymbol()
            .getDeclarations()[0] as any).getKeyType() as Type;
          const returnType = (memberType
            .getSymbol()
            .getMembers()[0]
            .getDeclarations()[0]
            .getSymbol()
            .getDeclarations()[0] as any).getReturnType() as Type;
          this.addSymbol(keyType, false);
          this.addSymbol(returnType, false);
        }
        if (
          memberType
            .getSymbol()
            ?.getDeclarations()[0]
            ?.getKind() === 179
        ) {
          const keyType = (memberType
            .getSymbol()
            .getDeclarations()[0]
            .getType().compilerType as any).constraintType.aliasSymbol.escapedName;
          const returnType = (memberType.getSymbol().getDeclarations()[0].compilerNode as any).type.typeName
            ?.escapedText;

          this.addSymbol(
            memberType
              .getSymbol()
              .getDeclarations()[0]
              .getSourceFile()
              .getTypeAlias(keyType)
              .getType(),
            false
          );
          if (returnType) {
            this.addSymbol(
              memberType
                .getSymbol()
                .getDeclarations()[0]
                .getSourceFile()
                .getTypeAlias(returnType)
                .getType(),
              false
            );
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
