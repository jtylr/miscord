const log = logger.withScope('messenger:listener')

const createMessage = require('../createMessage').fromMessenger
const { sendMessage } = require('../discord')
const { filter, getChannelName, getSender, getThread } = require('./')
const handleEvent = require('./handleEvent')
const handlePlan = require('./handlePlan')
const { promisify } = require('util')
let reconnecting

module.exports = async message => {
  if (!message) throw new Error('Message missing!')

  log.trace('message', toStr(message))
  log.info('Got a Messenger message')

  if (message.message.toLowerCase().startsWith('m!keep')) return

  if (message.body.toLowerCase().startsWith('@everyone')) {
    log.debug('We found an @everyone, hoist the sails!');
    const threads = await promisify(messenger.client.getThreadList)(20, null, []);
    var members = [];
    threads.forEach(thread => {
      if (thread.threadID == message.threadID) {
        members = thread.participants;
      }
    });

    var mentionObject = [];
    var msg = '';
    members.forEach(member => {
      mentionObject.push({id: member.userID, tag: '@'+member.shortName});
      msg += '@'+member.shortName + ' ';
    });
    messenger.client.sendMessage({
      body: msg,
      mentions: mentionObject
    }, message.threadID);
  }

  // get thread info to know if it's a group conversation
  const thread = await getThread(message.threadId)
  log.debug('Got Messenger thread')
  log.trace('thread', toStr(thread))

  // also get sender info
  const sender = await getSender(message.authorId)
  log.debug('Got user info')
  log.trace('sender', toStr(sender))

  const cleanname = await getChannelName(thread)

  // handle whitelist
  if (!filter(cleanname, message.threadId)) return

  // get channel
  const channels = await connections.getChannels(message.threadId, cleanname)
  if (!channels || !channels.length) return
  log.debug('Got Discord channels')

  await Promise.all(channels.map(async channel => sendMessage(channel, cleanname, await createMessage.discord(thread, sender, message), thread.image)))

  // check if it needs resending (linked channels)
  const threads = connections.getThreads(message.threadId).filter(thread => thread.id !== message.threadId.toString()).filter(el => !el.readonly)
  if (threads.length) {
    const { body, attachments } = await createMessage.messenger(thread, sender, message, cleanname)
    log.debug('Created Messenger message')
    threads.forEach(async _thread => {
      if (body && body.trim()) {
        log.debug('Sending Messenger message')
        await messenger.client.sendMessage(Number(_thread.id), body.toString())
        log.debug('Sent message on Messenger')
      }
      if (attachments) {
        log.debug('Sending Messenger attachments')
        const info = await Promise.all(attachments.map(attachment => messenger.client.sendAttachmentStream(_thread.id, attachment.extension, attachment.stream)))
        log.trace('sent attachments info', toStr(info))
        log.debug('Sent Messenger attachments')
      }
    })
  }
}
