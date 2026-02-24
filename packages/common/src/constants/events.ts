// TeamSpeak ServerQuery Event Names
export const TS_EVENTS = {
  CLIENT_ENTER: 'notifycliententerview',
  CLIENT_LEFT: 'notifyclientleftview',
  CLIENT_MOVED: 'notifyclientmoved',
  SERVER_EDITED: 'notifyserveredited',
  CHANNEL_EDITED: 'notifychanneledited',
  CHANNEL_DESCRIPTION_CHANGED: 'notifychanneldescriptionchanged',
  CHANNEL_CREATED: 'notifychannelcreated',
  CHANNEL_DELETED: 'notifychanneldeleted',
  CHANNEL_MOVED: 'notifychannelmoved',
  CHANNEL_PASSWORD_CHANGED: 'notifychannelpasswordchanged',
  TEXT_MESSAGE: 'notifytextmessage',
  TOKEN_USED: 'notifytokenused',
} as const;

export type TSEventName = (typeof TS_EVENTS)[keyof typeof TS_EVENTS];

export const TS_EVENT_LABELS: Record<string, string> = {
  [TS_EVENTS.CLIENT_ENTER]: 'Client Connected',
  [TS_EVENTS.CLIENT_LEFT]: 'Client Disconnected',
  [TS_EVENTS.CLIENT_MOVED]: 'Client Moved',
  [TS_EVENTS.SERVER_EDITED]: 'Server Edited',
  [TS_EVENTS.CHANNEL_EDITED]: 'Channel Edited',
  [TS_EVENTS.CHANNEL_DESCRIPTION_CHANGED]: 'Channel Description Changed',
  [TS_EVENTS.CHANNEL_CREATED]: 'Channel Created',
  [TS_EVENTS.CHANNEL_DELETED]: 'Channel Deleted',
  [TS_EVENTS.CHANNEL_MOVED]: 'Channel Moved',
  [TS_EVENTS.CHANNEL_PASSWORD_CHANGED]: 'Channel Password Changed',
  [TS_EVENTS.TEXT_MESSAGE]: 'Text Message Received',
  [TS_EVENTS.TOKEN_USED]: 'Privilege Key Used',
};

// Event registration types for servernotifyregister
export const TS_EVENT_TYPES = ['server', 'channel', 'textserver', 'textchannel', 'textprivate'] as const;
