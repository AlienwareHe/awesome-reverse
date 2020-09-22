这篇是重打包的进一步详细解析，介绍了qcontainer中感染脚本如何使用及原理
1. 安卓应用的打包流程
2. APK的文件结构
3. AndroidManifest.xml二进制文件（即AXML）解析
4. 修改axml的工具类库：org.jf.pxb.android.axml
5. 安卓应用签名

整个工程可以从dev-camel.sh作为入口分析应用重打包的整个过程
## 一、dev-camel.sh
usage：./dev-camel.sh /xxx/xxx.apk -o /xxx/xxx.camel.apk

其他更多参数可参考:
```
        options.addOption(new Option("w", "workdir", true, "set a camel working dir"));
        options.addOption(new Option("t", "tell", false, "tell me the output apk file path"));
        options.addOption(new Option("h", "help", false, "print help message"));
        options.addOption(new Option("o", "output", true, "the output apk path or output project path"));
        options.addOption(new Option("s", "signature", false, "signature apk with camel default KeyStore"));
        options.addOption(new Option("d", "debug", false, "add debuggable flag on androidManifest.xml "));
        options.addOption(new Option("dex", "dex", false, "use dex rebuild to repackage"));
        options.addOption(new Option("f", "frida", false, "embed frida-gadget.so"));
```

原理：利用container-builder打包出的jar包进行构建

## Container-Builder
### 命令行参数解析

### 工作目录
整个重打包的过程中，涉及到许多文件，包括原APK和很多中间临时文件等，因此统一在一个工作目录中进行处理。

### camel-engine.apk
从resources目录下复制到工作目录中，后面会用到该apk中的dex文件以及so文件。

### 拷贝原APK中文件
除了META-INF目录下和AndroidManifest.xml外全部复制，

同时还会记录dex中最大编号，后面复制camel-engine.apk中的dex文件时会用上。

原理：apk文件其实是个zip文件，使用org.apache.tools.zip可以快速解析zip文件

### AndroidManifest.xml修改

流程：
1. 如果包含-d参数，开启debuggable标记
2. 修改AXML中name字段，将入口更改为自定义的Application，如此一来便可完成插件hook代码的执行代码的注入。

### 植入dex和so文件
将camel-engine.apk中的dex文件以及lib目录下的so文件复制到目标apk下

其中so文件需要按照apk的cpu架构不同区分，如** armeabi/armeabi-v7a/x86 **
https://www.jianshu.com/p/ed9c3fea3584

### 将构建信息存储到assets目录下

### 签名
1.  zipalign 归档对齐APK    
https://developer.android.google.cn/studio/command-line/zipalign.html
2. 用默认的密钥进行签名


## 疑问
1. container-builder中injectCamelEngineApk task何时执行
2. camel-engine.apk的作用
3. camel-engine.apk中的dex和so文件拷贝之后，如何执行，比如Xpatch中是在Application静态代码块里插入代码作为入口。
4. AndroidManifest.xml中文件里name字段对应哪个标签
5. 如果不需要重新签名，就不执行zipalign

### 1.injectCamelEngineApk task何时执行
此处利用了Gradle Task机制，在container打包前预先打包runtime生成camel-engine.apk并复制至container的resources目录下。
```
//engine apk
task injectCamelEngineAPK(type: Copy) {
    from '../container-runtime/build/outputs/apk/debug/container-runtime-debug.apk'
    into 'src/main/resources/'
    rename {
        Constants.CAMEL_ENGINE_RESOURCE_APK_NAME
    }
}
// 以下两行配置可以达到：在container-builder assemble的时候执行injectCamelEngineAPK Task，进而执行:container-runtime:assembleDebug保证构建的时候有camel-engine.apk
injectCamelEngineAPK.dependsOn(':container-runtime:assembleDebug')
processResources.dependsOn(injectCamelEngineAPK)
```

### 2.camel-engine.apk的作用
camel-engine.apk用于实现插件的加载执行和hook框架的初始化等，其中的dex文件和so文件将会被复制到目标APK中，类似于Xpatch中XposedModuleEntry入口所在的用于加载已安装的Xposed Modules的类库。

可以说该apk是重打包后的apk能够实现加载插件和hook的核心所在。
### 3.camel-engine.apk中dex和so文件如何执行
在编辑原APK的AndroidManifest.xml时，会将原APK的入口Application类替换为camel-engine.apk中的Application类，达到入口接管注入代码的目的。
