# QContainer中的Hook
QContainer所实现的是一个在免Root环境下完成类Xposed Hook的安卓应用分身框架，Hook功能基于SandHook和Substrate完成。

对于只是想完成一个Hook插件的功能，在使用方式上，原生Xposed与QContainer几乎没有差别，但仍有一些实现原理上导致的细节差异：
- Hook API名称不同，QContainer为Rposed相关，主要是为了防止APP检测Xposed痕迹
- QC插件只能作用于经过QC感染后的APP
- QC插件只会对插件中配置的特定的感染APP生效（若想对全部感染APP生效，可以用*），因此插件中无需区分APP。
- QC插件支持热发更新配置 
- QC插件目前尚不支持资源Hook

# QContainer插件Quick Start
接下来介绍一下如何快速创建一个QC插件：
- 创建一个普通安卓APP工程，可以通过ratel-qunar-crack项目下的template.sh脚本，或者AS创建
- 配置AndroidManifest.xml，QC插件是否能够被QContainer Manager识别就在于清单文件中的meta配置。这里主要有以下几个配置：
```
<!-- 插件标识 -->
<meta-data android:name="xposedmodule" android:value="true"/>
        
<!-- 插件描述，QC Manager中会显示 -->
<meta-data android:name="xposeddescription" android:value="auto generated crack for: crack-ctrip-accounts-camel"/>

<!-- 目标作用APP -->
<meta-data android:name="for_camel_apps" android:value="ctrip.android.view"/>

<!-- 应用分身模式，一个分身代表一个设备，MULTI代表多分身，插件控制切换，START_UP代表每次启动都会新建分身，DISABLE或者不配置则为不开启 -->
<meta-data android:name="virtualEnvModel" android:value="MULTI" />
```
- 引入camel-api.aar，该aar是QC中对外暴露的API，包括Hook 和自动点击等API，类似于XposedBridge.jar。目前没有引入gradle仓库配置，因此目前使用aar文件直接依赖，后续可以优化。在开发或迭代 camel-api项目时需要额外注意，感染后的APP中也存在camel-api，因此两边的依赖注意覆盖冲突同步或者兼容。使用时先在插件根目录下新建libs文件夹，将camel-api.aar导入，其次配置build.grale完成依赖。
```
dependencies {
    implementation fileTree(dir: 'libs', include: ['*.jar'])
    api(name: 'com.camel.api_1.4.6', ext: 'aar')
}
```
- src/main/assets文件下配置xposed_init文件，标识插件IRposedHookLoadPackage接口实现类，值得注意的是，handleLoadPackage方法执行时QContainer还未开始设备指纹分身和模拟，因此如果想要获取真实设备信息可在该方法中获取，定时任务自动调度也是同理。
- （可选）src/main/assets文件下配置camel_scheduler.json文件，标识插件接入QC自动调度框架，并配置CamelTask接口实现类。
- （可选）配置热发插件更新地址
```
<!--是否是一个热发插件-->
<meta-data android:name="isHotModule" android:value="true" />
<!--热发插件服务查询的服务端地址-->
<meta-data android:name="hotModuleServerUrl" android:value="htps://xxx.com/xxx" />
```

# CamelToolKit API
CamelToolKit类是camel-api包中所暴露的API中的工具类入口，在实际Hook插件编写中经常用到，提供了IO重定向、Hook上下文、定时任务等一些列的辅助API，还提供了控制Manager能力的API，例如小米机型切换飞行模式。

## Hook上下文
- sContext 全局的一个context，context是调用Android系统功能的重要对象。有这个对象之后，无需手动通过拦截attach的方式获取context
- hostClassLoader 宿主APK的ClassLoader
- processName 当前进程名称
- packageName 当前应用包名

CamelToolKit中对这几项属性进行了赋值，方便插件中使用，否则在原生Xposed中需要手动获取context。同时如果想要在插件中判断当前进程是否是主进程，则可以使用CamelToolKit.processName与CamelToolKit.packageName是否相等来判断，原理是安卓中主进程的进程名称与应用包名相同。

## 切换应用分身
应用分身是QContainer的核心功能，可以理解为一个应用分身对应着一个全新的同型号设备，分身中会对设备信息、地理位置进行一定的范围随机模拟，通常在插件IRposedHookLoadPackage#handleLoadPackage中使用CamelToolKit.virtualEnv.switchEnv(String)来控制切换时机，但如果阅读了QContainer的源码之后，可以发现并不是一定需要在插件Hook加载的时机才可以进行切换分身，在定时调度CamelTask#loadTask方法中也是可以切换分身，而且使用CamelToolKit切换时也并不是立即切换，该步骤仅仅是设置了待切换的分身ID，需要在插件IRposedHookLoadPackage执行完后才会真正执行切换逻辑。

和应用分身相关的API在CamelToolKit#virtualEnv中，其中使用频率最高的就是switchEnv方法，用于控制切换到哪个分身。其次还有一个分身管理的相关方法：
- removeUser(String) 删除分身，但不能删除当前分身
- nowUser() 当前分身
- availableUserSet() 获取当前设备中所有分身
- disableFakeFingerprint() 不使用QC所提供的指纹模拟功能

## IO重定向
由于QContainer的分身功能基于IO重定向实现，例如将应用data目录重定向到一个虚拟的目录，如果获取文件时机不对，可能会出现预期获取某个文件但是报错文件未找到的IO异常情况，例如QC早期开发中遇到非常多这类问题，为了便于定位这些问题，将重定向的相关API对外暴露方便获取某个路径是否被重定向等。

使用时通过CamelToolKit#ioRelocator即可，具体API如接口所示，这里简单介绍几个常用的API：
- String getRedirectedPath(String origPath); //获取某个路径重定向后的路径，若未重定向则返回原路径
- void redirectFile(String origPath, String newPath); //重定向某个文件至新路径
- void whitelistFile(String path); //将某个路径加入白名单
- void forbid(String path, boolean file); //设置某个路径为不存在
- void readOnlyFile(String path); // 设置某个路径为只读文件

## ICamelManagerSupport & ICamelSchedulerTaskHandler
这两个类分别是Manager提供的辅助功能以及定时任务相关API，目前仅提供了切换小米机型的飞行模式功能，待后续需求需要定制扩展。
