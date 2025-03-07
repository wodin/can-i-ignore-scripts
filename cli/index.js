#!/usr/bin/env node
const fs = require('fs')
const glob = require('glob')
const util = require('util')
const _ = require('lodash')
const fetch = require('undici-fetch')
const localData = require('./data.json')

const scriptNames = ['preinstall', 'postinstall', 'install']

console.log(`
█▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀█
  ▄▄·  ▄▄▄·  ▐ ▄    ▄     ▪    ▄▄     ▐ ▄       ▄▄▄   ▄▄▄      ▄▄▄▄·
 ▐█ ▌ ▐█ ▀█ ·█▌▐█   ██    ██  ▐█ ▀    █▌▐█      ▐▄ █· █  ▀·  .▀  .█▌
 ██ ▄▄▄█▀▀█ ▐█▐▐▌   ▐█·   ▐█· ▄█ ▀█▄ ▐█▐▐▌ ▄█▀▄ ▐▀▀▄ ▐█▀      ▄█▀▀▀·
 ▐███▌▐█ ▪▐▌██▐█▌   ▐█▌   ▐█▌ ▐█▄ ▐█ ██▐█▌▐█▌.▐▌▐▄ █▌▐█▄▄▄▌   ▀
 ·▀▀▀  ▀  ▀ ▀▀ █▪   ▀▀▀   ▀▀▀ ·▀▀▀▀  ▀▀ █▪ ▀█▄▀▪.▀  ▀ ▀▀▀     ▀
`)

const files = glob.sync('node_modules/**/package.json')
const found = _.chain(files)
    .map(file => {
        const { name, scripts, version } = JSON.parse(fs.readFileSync(file))
        return { name, version, scripts: _.pick(scripts, scriptNames), path: file.substr(0, file.length - 12) }
    })
    .filter(pkg => Object.keys(pkg.scripts).length > 0)
    .groupBy(pkg => pkg.name)
    .value()

if (Object.keys(found).length === 0) {
    console.log('No scripts found')
    process.exit(0)
}

console.log('▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀')
fetch(`https://can-i-ignore-scripts.vercel.app/api/check?packages=${Object.keys(found).join(',')}`)
    .then(response => response.json())
    .catch(err => {
        console.error(` // Falling back to offline data, couldn't fetch. Error: ${err.message} \n`)
        return localData;
    })
    .then(data => {
        console.log(`Found following packages with scripts:`)
        const keep = [];
        console.log(Object.keys(found).map(name => {
            if (data.ignore[name]) {
                return `[ ignore ] '${name}' has scripts but they can be ignored \n             reason: ${data.ignore[name]}`
            } else if (data.keep[name]) {
                keep.push(name)
                return `[  keep  ] '${name}' needs its scripts to run`
            } else {
                let tip = ''
                if (found[name].flatMap(pkg => Object.values(pkg.scripts)).join('').includes('gyp ')) {
                    tip = '(it uses gyp, so you probably need it)'
                    keep.push(name)
                }
                return `[ check? ] '${name}' needs reviewing ${tip}\n${util.inspect(found[name])}`
            }
        }).sort().reverse().join('\n'))
        console.log(`
▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
What now? Run rebuild after 'npm ci --ignore-scripts' to trigger 
scripts you need to keep. `)
        if (keep.length > 0) {
            console.log(`
A suggestion to get you started:
npm rebuild ${keep.join(' ')}`)
        } else {
            console.log(`
Just use something like this: npm rebuild package1 package2`)
        }
        console.log('█▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄█\n')
        console.log('If you check some packages, consider contributing your findings on github.')

    }).catch(err => {
        console.error(err)
    })

