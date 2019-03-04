export interface SomeRequest {
  id: string;
  idn: number;
  idnNull?: number;
  idb: boolean;
  idStArray: string[];
  answers: SomeRequestAnswer[];
}

export interface SomeRequestAnswer {
  answerId: string;
  decision: 'positive' | 'negative';
}
