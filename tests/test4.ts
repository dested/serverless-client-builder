export type ChatMessage = {
  id: string;
  date: string;
  time: string;
} & (
  | {
      source: 'server';
      data: ChatServerMessageData;
    }
  | {
      source: 'client';
      data: ChatClientMessageData;
    });

export type ChatServerMessageData = {
  inputHint?: 'none' | 'text' | 'drug-search';
  responseContext?: 'drug-search';
  placeHolderText?: string;
} & (
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'intro-buttons';
    }
  | {
      type: 'loading';
    }
  | {
      type: 'load-more';
    }
  | {
      type: 'loading-more';
    });

export type ChatClientMessageData =
  | {
      type: 'text';
      text: string;
      zipcode: string;
    }
  | {
      type: 'search-drug';
      drugId: number;
      text: string;
      zipcode: string;
    };
