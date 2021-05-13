export class Utils {
  static unique<T>(items: T[], unique: (t: T) => string): T[] {
    const uns: string[] = [];
    const founds: T[] = [];
    for (const item of items) {
      const val = unique(item);
      if (uns.indexOf(val) === -1) {
        founds.push(item);
        uns.push(val);
      }
    }
    return founds;
  }
}
