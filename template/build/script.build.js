process.env.NODE_ENV = 'production'
process.env.CORDOVA_TARGET = process.argv[2] || 'desktop'
process.env.THEME = process.argv[3] || ''

require('colors')

var
  shell = require('shelljs'),
  path = require('path'),
  fs = require('fs'),
  fse = require('fs-extra'),
  et = require('elementtree'),
  env = require('./env-utils'),
  css = require('./css-utils'),
  config = require('../config'),
  spawn = require('./spawn'),
  webpack = require('webpack'),
  webpackConfig = require('./webpack.prod.conf'),
  targetPath = webpackConfig.output.path

if (env.android && !shell.test('-f', path.resolve(__dirname, `../cordova/platforms/android/release-signing.properties`))) {
  console.log('Please modify ' + 'cordova/release-signing.sample'.yellow
  + ', then copy to ' + 'cordova/platforms/android/release-signing.properties'.yellow + ' for apk sign.')
  process.exit()
}

shell.rm('-rf', targetPath)
console.log(' Cleaned build artifacts.\n')
  
console.log(' WARNING!'.bold)
console.log(' Do NOT use VueRouter\'s "history" mode for Cordova or Electron.\n')
console.log((' Building with "' + env.theme + '" theme...\n').bold)

shell.mkdir('-p', targetPath)
shell.cp('-R', 'src/statics', targetPath)

function finalize () {
  console.log(('\n Build complete with "' + env.theme.bold + '" theme in ' + targetPath.bold + ' folder.\n').cyan)
  let configFile = path.resolve(__dirname, '../cordova/config.xml')
  let doc = et.parse(fs.readFileSync(configFile, 'utf-8'))
  let packageId = doc.getroot().get('id')  
  let packageVer = doc.getroot().get('version') 
  let icon = doc.getroot().find('icon')

  if (env.android) {
    spawn.sync('cordova',['build', 'android', '--release'], path.resolve(__dirname, '../cordova'))

    let targetApk = packageId + '-' + packageVer + '.apk'
    let sourceApk = '../cordova/platforms/android/build/outputs/apk/android-release.apk'
   
    //兼容处理cordova-android 6.3/6.4/7.x
    if (!shell.test('-f',path.resolve(__dirname, sourceApk))) {
      sourceApk = '../cordova/platforms/android/build/outputs/apk/release/android-release.apk'
    }
    if (!shell.test('-f',path.resolve(__dirname, sourceApk))) {
      sourceApk = '../cordova/platforms/android/app/build/outputs/apk/release/app-release.apk'
    }
    if (!shell.test('-f',path.resolve(__dirname, sourceApk))) {
      console.log('Release apk not found, check build errors')
      process.exit()
    }

    fse.copySync(
      path.resolve(__dirname, sourceApk), 
      path.resolve(__dirname, '../' + targetApk))
    console.log('Release apk file: ' + targetApk.yellow)

    let devices = spawn.getOutput('adb',['devices'])
    console.log(devices.stdout)
    if (devices.stdout.match(/device$/)) {
      console.log('try to install apk to device')
      let result = spawn.getOutput('adb',['install','-r',targetApk])
      console.log(result.stderr)
      if (result.stdout.indexOf('INSTALL_FAILED_UPDATE_INCOMPATIBLE') != -1 ||
          result.stderr.indexOf('INSTALL_FAILED_UPDATE_INCOMPATIBLE') != -1 ) {
        console.log("apk INCOMPATIBLE, uninstall and reinstall...")
        spawn.sync('adb',['uninstall',packageId])
        spawn.sync('adb',['install', '-r', targetApk])
      }      
    }
  }

  if (env.ios) {
    console.log('remove icon for ios')
    fse.copySync(configFile, configFile + '.temp')
    doc.getroot().remove(icon)
    fs.writeFileSync(configFile, doc.write({ indent: 4 }), 'utf8')

    //--release还不行
    try {
      spawn.sync('cordova-icon',['--icon=../src/assets/icon.png'], path.resolve(__dirname, '../cordova'))
      spawn.sync('cordova',['build', 'ios', '--debug'], path.resolve(__dirname, '../cordova'))
    } finally {
      fs.rename(configFile + '.temp', configFile)
    }
  }
}

webpack(webpackConfig, function (err, stats) {
  if (err) throw err

  process.stdout.write(stats.toString({
    colors: true,
    modules: false,
    children: false,
    chunks: false,
    chunkModules: false
  }) + '\n')

  if (stats.hasErrors()) {
    process.exit(1)
  }

  if (config.build.purifyCSS) {
    css.purify(finalize)
  }
  else {
    finalize()
  }
})
