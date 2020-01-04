
const _ = require('lodash')
const Promise = require('bluebird')
const { log } = require('../../helpers.js')
const fs = require('fs')
Promise.promisifyAll(fs)
const requestify = require('../../requestify.js')
const inquirer = Promise.promisifyAll(require('inquirer'))

module.exports = async function (config) {
  let choice = {}

  while (choice.action !== '< Go Back') {
    const actionOpts = ['Create target']

    if (config.targets.length > 0) {
      actionOpts.push('Edit target')
      actionOpts.push('Delete target')
      actionOpts.push('List targets')
    }

    actionOpts.push('< Go Back')

    choice = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Manage targets',
      choices: actionOpts
    }])

    const targetChoices = config.targets.map(function (target) {
      const urlObj = new URL(target.url)
      return `[${target.name}] - '${target.theme_name}' @ ${urlObj.host}`
    })

    if (['Create target', 'Edit target'].includes(choice.action)) {
      let currTarget = {}
      let editIndex

      if (choice.action === 'Edit target') {
        const targetChoice = await inquirer.prompt([{
          type: 'list',
          name: 'target',
          message: 'Select target to edit',
          default: null,
          choices: targetChoices
        }])
        editIndex = _.indexOf(targetChoices, targetChoice.target)
        currTarget = config.targets[editIndex]
      }

      const targetSettings = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Enter a name for this target',
          default: (currTarget.name || null)
        },
        {
          type: 'input',
          name: 'url',
          message: 'Store URL? (Copy and paste the full "example URL" from the private app settings).',
          default: (currTarget.url || null)
        }
      ])

      currTarget = Object.assign(currTarget, targetSettings)

      const urlObj = new URL(currTarget.url)
      const pathParts = _.take(_.compact(urlObj.pathname.split('/')), 2).join('/')

      currTarget.url = urlObj.protocol + '//' + urlObj.username + ':' + urlObj.password + '@' + urlObj.host + '/' + pathParts

      const { themes } = await requestify(currTarget, {
        method: 'get',
        url: '/themes.json'
      })

      let defaultTheme = _.find(themes, { id: currTarget.theme_id })
      if (defaultTheme) { defaultTheme = `${defaultTheme.name} (${defaultTheme.role})` }
      const themeChoices = themes.map(theme => `${theme.name} (${theme.role})`)

      const themeChoice = await inquirer.prompt([{
        type: 'list',
        name: 'theme',
        message: 'Select theme',
        default: defaultTheme || null,
        choices: themeChoices
      }])

      const theme = themes[_.indexOf(themeChoices, themeChoice.theme)]
      currTarget.theme_name = theme.name
      currTarget.theme_id = theme.id

      if (isFinite(editIndex) && editIndex !== -1) {
        config.targets[editIndex] = currTarget
        log('Target Modified!\n\n', 'yellow')
      } else {
        config.targets.push(currTarget)
        log('Target Created!\n\n', 'yellow')
      }
    } else if (choice.action === 'Delete target') {
      const targetChoice = await inquirer.prompt([{
        type: 'list',
        name: 'target',
        message: 'Select target to edit',
        default: null,
        choices: targetChoices
      }])
      const editIndex = _.indexOf(targetChoices, targetChoice.target)
      config.targets.splice(editIndex, 1)
    } else if (choice.action === 'List targets') {
      console.log('')
      targetChoices.forEach(function (target) {
        log(target, 'cyan')
      })
      console.log('')
    }
  }

  return config
}
