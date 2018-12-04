export type a = {
  b?: string;
} & (
  | {
      c: number;
      d: string;
    }
  | e);

export type e = {
  f: number;
};
