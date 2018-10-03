const log = logger.withScope('createMessage:fromDiscord:messenger')
const handleCustomEmoji = require('./handleCustomEmoji')
const downloadFile = require('./downloadFile')

module.exports = async message => {
  let username = message.member ? (message.member.nickname || message.author.username) : message.author.username
  let content = message.cleanContent
  content = handleCustomEmoji(content)

  // copy message content to a new variable, as the cleanContent property is read-only
  log.debug('clean content', content)

  let embedImageURL

  // parse embed into plaintext
  if (message.embeds.length > 0 && !config.messenger.ignoreEmbeds) {
    message.embeds.forEach(embed => {
      if (embed.title) content += '\n' + embed.title
      if (embed.url && !content.includes(embed.url)) content += '\n(' + embed.url + ')'
      if (embed.description) content += '\n' + embed.description
      embed.fields.forEach(field => { content += '\n\n' + field.name + '\n' + field.value })
    })
    log.debug('content with embed', content)
    // get image url from discord embeds
    embedImageURL = message.embeds.length > 0
      ? (message.embeds[0].image
        ? message.embeds[0].image.url
        : (message.embeds[0].thumbnail
          ? message.embeds[0].thumbnail.url
          : undefined
        )
      )
      : undefined
  }

  const body = config.messenger.format
    .replace('{username}', username)
    .replace('{content}', content)
    .replace('{message}', content)
    .replace('{source}', config.messenger.sourceFormat.discord)
    .replace('{newline}', '\n')

  const attachments = await Promise.all([embedImageURL].concat(message.attachments.map(attach => attach.url)).filter(el => el).map(downloadFile))
  return { body, attachments }
}
