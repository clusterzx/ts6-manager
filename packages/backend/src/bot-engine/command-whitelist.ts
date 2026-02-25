/**
 * Whitelist of TS3 WebQuery commands allowed in bot flow "webquery" actions.
 * Destructive commands (serverstop, serverdelete, instanceedit, permissionreset, etc.)
 * are intentionally excluded to prevent abuse.
 */
export const ALLOWED_WEBQUERY_COMMANDS = new Set([
  // Server info (read-only)
  'serverinfo',
  'serverlist',
  'servergrouplist',
  'servergroupsbyclientid',

  // Channel operations
  'channellist',
  'channelinfo',
  'channelfind',
  'channelcreate',
  'channeledit',
  'channeldelete',
  'channelmove',

  // Client operations
  'clientlist',
  'clientinfo',
  'clientfind',
  'clientgetids',
  'clientgetdbidfromuid',
  'clientgetnamefromuid',
  'clientgetnamefromdbid',
  'clientmove',
  'clientkick',
  'clientpoke',
  'clientdblist',
  'clientdbinfo',

  // Messaging
  'sendtextmessage',
  'messageadd',
  'messagelist',
  'messagedel',
  'messageget',

  // Groups
  'servergroupaddclient',
  'servergroupdelclient',
  'servergroupclientlist',
  'channelgrouplist',
  'channelgroupclientlist',
  'setclientchannelgroup',

  // Bans
  'banclient',
  'banlist',
  'bandel',
  'banadd',

  // Tokens
  'tokenadd',
  'tokenlist',
  'tokendelete',

  // Complaints
  'complainlist',
  'complaindel',
  'complainadd',

  // Logs
  'logview',

  // Misc read-only
  'whoami',
  'version',
  'hostinfo',
  'connectioninfo',
]);
