本篇主要介绍如何进行重打包注入代码，以及重打包后如何绕过大多数的签名校验。

对于想要在免Root设备上实现一个代码注入，一般有两种方式：
- 类似VirtualApp的沙盒环境，由于VA对APP运行时使用到的系统组件都进行了动态代理，所以APP相当于运行在VA中，VA具有上帝视角和权利。
- 进程内注入机制例如重打包，如Xpatch、太极

QContainer采用的机制就是重打包机制，重打包是指通过修改对方的APK然后重新签名的过程，在修改的过程中，可以对对方的清单文件AndroidManifest.xml、DEX文件、SO文件、资源文件进行修改、新增和删除操作，市面上很多逆向入门教程就是通过将DEX文件反编译为smali、然后通过修改smali并回编会dex文件来进行逻辑修改和注入。在修改之后还需要将文件重打包回APK并进行二次签名，因为无法获取到原APK的签名证书，所以如果对方APK做了签名校验或文件校验，还需要通过hook或代理的方式绕过APP的校验逻辑。

# APK签名绕过
对于APK签名校验一般可通过hook PMS的方式进行绕过，实际上使用动态代理替换PMS也能完成，但是存在classloader痕迹，因此使用APK签名校验会更全面：
- android.content.pm.IPackageManager$Stub$Proxy#getPackageInfo
- android.webkit.IWebViewUpdateService$Stub$Proxy#waitForAndGetProvider

具体如何进行绕过，可以参考VirtualApp的做法：https://github.com/asLody/VirtualApp/blob/1fdc070f4be8be7272725807b60235beaf2a5717/VirtualApp/lib/src/main/java/com/lody/virtual/server/pm/parser/PackageParserEx.java

但是，这种方式只能绕过一般的签名校验，如果对方校验文件哈希等与文件有关的操作，那么重打包的痕迹将会立马被发现，因此最好可以通过IO重定向的方式，将base.apk重定向到一个原始未修改过的APK文件，如此一来，对方通过文件进行签名校验便可完美绕过。具体IO重定向的方式可参考VirtualApp中做法。

# 重打包机制
Xposed是通过修改Zygote进程，然后在zygote进程中hook ActivityThread#handleBindApplication来在APP进程初始化之前执行hook代码来完成hook操作，该方法的主要功能就是创建Application，并调用其attachBaseContext、onCreate等方法，因此，在Application创建之前就实现Xposed Hook。那重打包应该在哪插入代码才能获取比应用启动更早的时机呢？

Xpatch中也有提到，这里有两种方案，每种方案都有自己适用的场景，原理都是基于安卓中默认入口为Application，只不过一个为替换，一个为插入。
- AndroidManifest.xml中Application入口替换，这种方式的优势在于未修改原application，且适用于目标APP未集成Application重写的情况，但是容易通过入口堆栈检测发现痕迹
- application实现类中插入静态代码块，这种方式的优势在于无入口堆栈检测痕迹，但是存在文件修改痕迹。

两种方案各有千秋，各有各的适用场景，因此实际情况中某种方案失败，可以尝试另一种情况。

## application实现类中插入静态代码块
Xposed插件加载时会使用到Context参数，而在静态代码块中，应用Context尚未创建，此时我们应如何获取Context？

虽然Android SDK中没有提供应用自己创建context的方法，但是既然安卓系统可以创建，我们是不是也可以通过反射来创建，Xpatch正是通过阅读安卓源码通过反射进行创建context。
```
引申：什么是context，什么是Application？安卓中如何启动一个应用？

首先了解安卓如何启动一个APP进程：
默认情况下每个APP运行在自己的Linux进程中，每个进程被系统分配一个唯一的userID。
与众多基于Linux内核的系统类似，安卓在启动系统时，bootloader启动内核和init进程，init进程分裂出更多底层的守护进程如android debug deamo/USB deamon等。
随后，init进程会启动一个安卓中有名的「Zygote」进程，该进程初始化了第一个VM，并且预加载了framework等。

当启动一个APP时，会从zygote进程中孵化一个新的VM创建一个新的进程，然后将进程和指定的Application绑定，这样就得到了一个APP的进程。

Application和Context的含义：
当app启动时系统会创建一个唯一的Application对象用来存储一些系统信息，生命周期也是伴随着整个程序的生命周期，由于Application是全局唯一的，因此有用于进行一些数据传递、数据共享和数据缓存等操作。
Context从字面上理解就是上下文的意思 ，并且是Application的父类。
```
从代码中看Application创建的流程：
1. ActivityThread#handleBindApplication
2. LoaderApk#makeApplication
    * **创建一个Context对象**
    * 调用Instrumentation的newApplication方法
3. 调用application#onCreate方法

在第二步中可以看到 构建Context的方法：
```
ContextImpl appContext = ContextImpl.createAppContext(mActivityThread, this);

// android.app.ContextImpl.java
static ContextImpl createAppContext(ActivityThread mainThread, LoadedApk packageInfo) {
        if (packageInfo == null) throw new IllegalArgumentException("packageInfo");
        ContextImpl context = new ContextImpl(null, mainThread, packageInfo, null, null, null, 0,
                null);
        context.setResources(packageInfo.getResources());
        return context;
    }
```
ActivityThread对象可通过ActivityThread#currentActivityThread()快速得到，因为一个进程只有一个ActivityThread对象。

另外一个对象LoadedApk对象，则是可以通过反射从全局变量中拿到。

到此在静态代码块中获取Context的问题便可解决，基于重打包注入代码的方案也得到了实现。

## application入口替换
application入口替换的方式则涉及到了AndroidManifest.xml文件的解析，需要从中解析出<application>标签，并设置name为我们实现的application，并在我们的application中执行完逻辑之后调用原Application的onCreate和attachBaseContext方法。

## 查找并加载Xposed插件
有了在应用启动前注入代码的能力之后，由于最终的目标是能够加载Xposed插件并提供hook能力，因此接下来需要做的是如何定位到插件APK并执行其中的代码，也就是之前所说的Xposed加载插件的原理的实现。

### 查找插件
在Xpatch中查找插件的方法是遍历所有已安装的APK，根据Xposed插件的特征，找到符合的插件。
```
Xposed插件开发时有个约定便是在AndroidManifest.xml文件中书写以下的meta-data标签：
<application
        <meta-data
                android:name="xposedmodule"
                android:value="true"/>
</application>
```

在QContainer中也是类似，但是查找的meta-data标签更多，即QC插件编写中所提及的那些标签属性。
### 加载插件APK
找到了插件APK之后，就可以得到APK的路径(/data/app/包名)，然后构建ClassLoader加载插件，主要流程如下：
```
1.根据插件Apk文件路径构造DexClassLoader；
2.读取Apk asset目录下''assets/xposed_init'文件中所有的类名；
3.根据类名和Classloader构造入口类，并执行类的入口方法handleLoadPackage。
```

## 注入代码的实现
前面虽然说了注入代码的时机和位置，但是现实中APK解压后得到的是编译后形成的dex二进制文件，dex文件有自定义的格式进行解析，若想要在dex文件中修改内容，一般来说有两种主流方法：
1. apktool反编译为smali文件，然后修改smali文件
2. 利用dex2jar将dex转换为jar，然后反编译为java代码进行修改，再使用jar2dex进行回编。

Xpatch使用的则是第二种方法，dex2jar工具的大致原理是先根据dex文件格式规则解析dex文件中的所有类信息，然后再利用ASM工具根据这些信息生成Class文件。

Xpatch在dex2jar的基础上修改了代码，在反编译成jar时增加一段用于在Application静态代码块中增加XposedModuleEntry.init()。

但这种方式效率较低，需要反编译所有DEX，因此QContainer采用了baksmali库即第一种方式，只需反编译出目标APK的Application对应的smali文件，然后插入预先编译好的smali静态代码块再回编到dex中完成smali替换操作，在查找smali文件时需要注意可能存在多层父类的情况，需要递归向上查找最上层父类进行插入。

## 致谢
- Xpatch
- Virjar