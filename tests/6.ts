export type TwitchSubscriberBadgeCount = '0' | '3' | '6' | '12' | '24' | '36' | '48' | '60' | '72' | '84' | '96';
export type TwitchEmoteResult = {
  subscriber_badges: {[months in TwitchSubscriberBadgeCount]: TwitchImage};
  //  cheermotes: {[numberOfBits in TwitchBitsCheerCount]: {[size in TwitchCheermoteSize]: string}};
};
export type TwitchImage = {
  image_url_1x: string;
  image_url_2x: string;
  image_url_4x: string;
  title: string;
};
