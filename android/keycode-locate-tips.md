# 关键代码定位
hook的前提是我们需要知道目标类名、方法甚至参数等等，整个逆向的核心也是为了找出目标关键方法，一般情况下，我们有以下几种方式或结合进行定位：
- DDMS
- UIAutomator
- 抓包
- 常用API Hook打印堆栈日志
- 源码审计，关键字搜索

# DDMS&UIAutomator
在安装完安卓sdk之后，tools目录和tools/bin目录下有许多实用的工具，例如monitor和uiautomator。monitor即ddms，可以用于虚拟机调试监控，例如进程查看、截屏、线程/内存DUMP、运行方法堆栈DUMP、文件查看、模拟控制等。其中部分功能需要root权限或者APP为debug模式，例如调试某个APP进程。

## 如何开启APP DEBUG模式
如果设备已root情况下，那么可以对所有APP进行调试，只需在DDMS中勾选show all process即可。或者如果设备是通过magisk获取root权限，那么可以通过修改ro.debuggable来设置全局app可调试。
```
adb shell //adb进入命令行模式
su //切换至超级用户
magisk resetprop ro.debuggable 1  //设置debuggable
stop;start; //一定要通过该方式重启
```
该方式的原理是ro.debuggable属性配置位于/default.prop文件中，而 /default.prop 又来源于手机每次启动时 boot.img 中 ramdisk 的挂载，maigsk实现原理中便是修改了ramdisk，因此通过magisk是完全可以修改该属性的。

如果设备未root的情况下，则需要APP在AndroiodManifest.xml中声明debuggable为true，例如:
```
 <application
        android:icon="@drawable/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/AppTheme" 
        android:debuggable="true">
```

那么岂不是说我们得是APP的开发者才能在未root的情况下开启debug模式，但实际上不然，QContainer的感染步骤贴心的提供了这个功能，只需在感染时加上-d参数，即可获得一个debug模式的app。

还有一种究极办法也是通杀办法就是自编译ROM修改ro.debuggable来设置全局可调试。

## DDMS方法调用堆栈定位
在APP开启DEBUG模式后，我们便可以选中该包名然后使用DDMS的方法调用堆栈DUMP功能来辅助关键方法定位。通过该方法，我们可以找出许多有效信息，例如按钮所绑定的点击事件监听方法、对方代码包名特征、网络库特征等等。

需要注意**该功能需要APP为DEBUG模式或者设备开启全局可调试**的情况下，才能使用。

## uiautomator
tools/bin/uiautomator是用于页面布局dump的一个工具，通过该工具可以得到页面上某个控件的相关信息例如resource-id、content-desc等等，我们在自动点击时也是通过这些信息来唯一定位我们需要操作的控件。

通过uiautomator观察页面上关键组件，尽可能找出一个唯一的ID或content-desc，同时从代码中布局xml文件中查找出唯一引用的地方，或者结合adb命令查看当前页面activity类名确定在类中的引用。在查找资源文件和R.java定位过程中需要注意资源id的十六进制的转换，可能资源文件中为十六进制，而java代码文件中为十进制。这里额外赘述一下资源ID定位的原理，在安卓开发中，应用程序资源可以分为两类，分别放在assets下和res目录下，前者通过AssetManager访问，后者则会在编译打包时赋予资源ID，这些ID就会被保存在R.java文件中（具体可以参考安卓APK打包流程），在引用这些资源时就会通过R.java引用。

但是uiautomator存在一个缺点，即dump时页面需要保持静止。在网上也是看到有人通过修改uiautomator源码的方式来解决这个问题，原理就是通过支持dump动态布局的api替换uiautomator默认dump布局的api：

https://github.com/512433465/autotest_helper

还有一种解决方式就是找到对方的动态组件，例如自动更换的banner，通过hook的方式禁止掉，比较麻烦。

# 抓包定位
抓包是安卓逆向中非常实用的入门技能，不同的APP也会有不同的对抗策略。但是抓包也只能限于Http/Https协议，若对方基于Socket等实现自定义TCP报文通信，那么就算拦截到了TCP报文也无法进行解析，接下来讲一下Https协议的抓包常用思路和对抗原理。

一般抓包工具有两种，代理或VPN。代理的典型工具有Charles、Burpsuite(渗透黑客经常用到的抓包工具)、Fiddler（不支持导入证书），VPN的典型工具则是HttpCanary。

无论是代理还是VPN抓包，由于Https证书加密的存在，Https协议的抓包都是基于中间人攻击，即客户端与中间人端通过中间人的自定义Https证书进行通信，如此一来中间人端就可对客户端的https报文进行解密获取请求参数，然后转发至服务端，响应也是同理。基于中间人攻击的Https协议抓包必须客户端信任中间人的Https证书，在安卓7.0之后APP默认也是不信任用户安装的证书，必须通过root权限安装至系统证书或者类似Va的平行空间或者hook的方式来绕过。

所以针对中间人攻击，便出现了客户端证书检测和双向检测的检测方式，客户端证书检测的方式可以hook相关系统api来进行绕过，例如常见的JustTrustMe插件，可解决大部分的客户端证书校验，但可能还存在一些混淆过后的无法被hook或其他校验的方式可以特殊分析。其次针对双向校验证书的检测方式，这种检测方式适用于服务器高度集中且版本管理较为严格例如银行等行业应用中，这种检测方式下，我们需要找出对方的证书文件和证书密码，然后导入到中间人中。

将上述进行总结和分类，客户端关于证书处理的逻辑分类:

| 安全等级 | 策略 | 信任范围 | 破解方法 |
|---|---|---|---|
| 0 | 完全兼容策略 | 信任所有证书包括自签发证书 | 无需特殊操作 |
| 1 | 系统/浏览器默认策略 | 信任系统或浏览内置CA证书以及用户安装证书| 设备安装代理证书 |
| 2 | system CA pinning | 只信任系统根证书,不信任用户安装的证书<br>(android 7.0支持配置network-security-config) | 注入或者root后将用户证书拷贝到系统证书目录 |
| 3 | CA Pinning <br> Root (intermediate) certificate pinning | 信任指定CA颁发的证书 | hook注入等方式篡改锁定逻辑 |
| 4 | Leaf Certificate pinning | 信任指定站点证书 | hook注入等方式篡改锁定逻辑<br>如遇双向锁定需将app自带证书导入代理软件 |

针对安全等级2，可以通过下述的方式hook进行绕过。
```
private static void trustAndroidRootTrustManager() {
        Class<?> rootTrustManagerClass;
        try {
            rootTrustManagerClass = ClassLoader.getSystemClassLoader().loadClass("android.security.net.config.RootTrustManager");
        } catch (Throwable throwable) {
            return;
        }

        for (Method method : rootTrustManagerClass.getDeclaredMethods()) {
            if (method.getName().equals("checkServerTrusted")
                    && method.getReturnType().equals(Void.TYPE)) {
                XosedBridge.hookMethod(method, new XC_MethodReplacement() {
                    @Override
                    protected Object replaceHookedMethod(MethodHookParam param) throws Throwable {
                                              return null;
                    }
                });
            }
        }
    }
```

针对客户端对特定证书的校验，则需要使用类似JustTrustMe等插件hook掉指定校验逻辑，原理上都是针对不同的网络类库校验的API进行hook。

找到证书文件很简单，一般apk进行解包，直接过滤搜索后缀名为p12的文件即可，一般常用的命令为tree -NCfhl |grep -i p12，直接打印出p12文件的路径，当然可能APP会对文件进行混淆，例如修改后缀名，因此在安卓逆向中千万不要通过后缀名去判断文件类型，可以通过file命令相对准确的根据文件特征进行判断。或者通过hook相关api例如java.security.KeyStore#load方法直接将证书路径和密码打印出来。

基于代理的方式还有一种缺点就是，如果对方在网络库中设置不走系统代理，那么代理就不能生效，因此应对这种措施可以使用VPN的方式来进行抓包。VPN的方式则是VPN痕迹很容易检测，但也通过hook绕过，因此还有一种究极办法是通过路由器抓包，例如给笔记本电脑装Kali Linux，eth0口插网线上网，wlan0口使用系统自带的热点功能，手机连上热点上网。

除了代理和工具的方式，还有就是万能的Hook方式，无论是hook通用的网络库例如OkHttp(珍惜的OkHttpCat)或者是针对对方的网络库定制的hook插件均可尝试，其次hook还可以解决TCP报文无法抓包的情况，但前提需要分析获得对方的TCP未加密报文数据所在方法。TCP协议分析的一个大致思路是通过DDMS查看对方的方法调用栈，查看是否有上层的网络库，例如美团实际上业务层使用的仍然是Retrofit Http库，然后在提交请求时根据开关或TCP通道是否可用判断是否要转发至TCP网络库层，因此在这个时机请求参数仍然是明文的，可以在该层做hook点进行抓包。其次通过调用栈也可以看出对方是基于socket还是nio channel，hook对应的方法也可以定位出对方TCP相关代码所在的包，进而继续分析代码。

除了hook的方式之外，对于TCP报文的抓包，还可分为三种，接口转储、驱动转储和路由转储：

接口转储：比如给outputStream.write下hook,把内容存下来看看，可能是经过压缩、或加密后的包，总之是字节流,例如virjar哥的SocketMonitor；

驱动转储：使用tcpdump将经过网口驱动时的数据包转储下来，再使用Wireshark进行分析；

路由转储：自己做个路由器，运行jnettop，观察实时经过的流量和IP，可以使用WireShark实时抓包，也可以使用tcpdump抓包后用WireShark分析。

# 常用API HOOK
该Hook方式实际上属于取巧，根据常用的一些经验推测对方可能使用的Hook点，例如hook JSON序列化和反序列化方法，或者hook Base64/AES/RSA等常用加密算法，甚至hook String的构造方法等等均是有可能定位到对方关键代码。

