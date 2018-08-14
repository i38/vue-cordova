require('colors')
var
  shell = require('shelljs'),
  path = require('path'),
  fse = require('fs-extra'),
  spawn = require('./spawn')

var androidPath = path.resolve(__dirname, '../cordova/platforms/android')
if (shell.test('-d',androidPath)) {
  console.log(' Found android dir, project already prepared.\n')
}
else {  
  shell.mkdir('-p', path.resolve(__dirname, '../cordova/www'))
  //cordova命令永远不会返回非0，所以下面的命令不会出错退出
  spawn.sync('cordova',['platform','add','android'], path.resolve(__dirname, '../cordova'))

  if (shell.test('-d',androidPath)) {
    spawn.sync('npm',['install'], path.resolve(__dirname, '../cordova'))
    fse.copySync(
      path.resolve(__dirname, '../cordova/release-signing.properties'), 
      path.resolve(__dirname, '../cordova/platforms/android/release-signing.properties')
    )
    console.log('Modify ' + 'cordova/platforms/android/release-signing.properties'.yellow + ' for apk sign.')
  }
  else {
    console.log(' Android platform install error.\n')
  }
}
