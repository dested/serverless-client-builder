import {RequestValidator} from './result';

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
  shoes: {foo?: number};
}

const someRequest = {
  id: 'foo',
  idb: true,
  answers: [
    {answerId: 'asdfb', decision: 'positive', shoes: {foo: 123}},
    {answerId: 'asdfb', decision: 'positive', shoes: {foo: 123}},
  ],
  idn: 12,
  idStArray: ['a', 'b', 'c'],
};

RequestValidator.SomeRequestValidator(someRequest);
