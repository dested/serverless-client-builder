import {Node, Type, TypeFormatFlags, TypeGuards} from 'ts-morph';

export class ManageSymbols {
  types = new Set<Type>();

  addSymbol(type: Node, topLevel: boolean) {
    const text = type.getType().getText(undefined, TypeFormatFlags.NoTruncation);
    if (text === 'any') return;
    if (text === 'Date') return;
    if (text === 'ObjectId') return;
    if (text === 'ObjectID') return;
    if (text.indexOf('Array') === 0) return;
    if (text === 'T') return '';
    if (text === 'T[]') return '';

    const descendants = type.getDescendants();
    for (const descendant of descendants) {
      let foundType;
      if (TypeGuards.isTypedNode(descendant) || TypeGuards.isIdentifier(descendant)) {
        foundType = descendant.getType();
      } else if (TypeGuards.isReturnTypedNode(descendant)) {
        foundType = descendant.getReturnType();
      }
      if (foundType) {
        if (!this.types.has(foundType)) {
          this.types.add(foundType);
          const symbol = foundType.getSymbol() ?? foundType.getAliasSymbol();
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

  private getSourceInternal(symbol: Type, addExport: boolean = true) {
    let str = (symbol.getSymbol() ?? symbol.getAliasSymbol())?.getDeclarations()[0].getText();
    if (!str) return '';
    if (addExport && str.indexOf('export') === -1) {
      str = 'export ' + str;
    }
    return str;
  }
}
