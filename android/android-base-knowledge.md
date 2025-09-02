# 安卓逆向基础知识
作为一个安卓逆向者，首先必须对逆向目标有一个大局观认知，对于任意一门语言的逆向均是如此。目标语言的编写语法、编译产物、编译过程、打包过程、执行原理，不需要深入，但需要了解。

对于安卓APP逆向，本身基于JVM，但在JVM规范的实现上有所不同，同时安卓各个版本的虚拟机也有许多细节不同，这些变更均会导致对Hook技术产生不同的影响，其中最大的变化就是从4.4到5.0，完成了Davilk虚拟机到ART虚拟机的转变，由于目前基本不存在安卓4.4以下的系统，所以主要学习ART虚拟机即可。

安卓逆向通常一个大致的流程如下所示，核心在于如何确定目标功能代码位置，以及如何还原对方代码逻辑
1. 反编译
2. 抓包/Uiautomator/DDMS
3. 脱壳
4. Hook
5. 算法还原/模拟调用/自动点击

所以我们首先对安卓虚拟机和安卓APK有个大概的了解，知晓从何下手。

## 安卓工程编译打包
在Java中为了跨平台执行，.java文件最终会被编译成.class字节码文件，然后被加载至虚拟机中执行，实际生产中，工程往往被打包成jar包或者war包部署运行。

在安卓中，工程的最终产物则是一个APK或者AAR包，APK不用过多介绍，.aar包则是类似于jar包，作为安卓应用程序模块的依赖项，但相比于Jar包，除了可以打包Java文件，还可以包含AndroidManifest.xml和资源文件，以及SO文件。

当我们对APP进行逆向时，往往从对方的APK入手，一个APK本质上是一个压缩包，我们可以通过重命名后缀为.zip打开，一个APK解压之后通常包含以下文件夹和文件：
- META-INF文件夹：应用证书和签名等信息
- res文件夹：界面布局文件和资源信息
- AndroidManifest.xml 安卓清单文件，非常重要，各项属性包名等和组件注册的地方，二进制格式文件，需要反编译
- classes*.dex 应用程序的字节码文件再编译后的产物dex文件目录
- resources.arsc
- lib文件夹：SO文件目录

可以发现，安卓中最终编译的产物并不是class文件而是dex文件，dex文件实际上是**多个class文件的集合**，dex文件对clas文件中的冗余信息进行了合并，多个class文件共享一个常量池，减少文件体积。SDK中有个dx工具专门用于将class文件转换为dex文件。（DEX文件的格式--安卓逆向必备）

### smali文件
安卓中除了.class文件和.dex文件，还有一种经常用到的smali文件，smali是安卓虚拟机字节码的一种助记方式，将二进制的字节码反编译成便于理解的特定语法格式，因此smali文件中对应着Java代码编译后的一条条字节码指令。

smali文件在逆向中的作用通常是用于校验Java代码反编译的是否正确，因为从指令反编译回Java语言往往会出现一些无法识别的情况，例如Jadx无法处理多层try-catch嵌套的情况，而smali代码是准确的，这时候我们就可以使用smali代码来辅助我们识别对方代码逻辑。例如当我们想Hook某个内部类时，由于内部类最终会被编译成类似A$1.class，所以我们可以从smali代码里获取该内部类编译后的具体类名。

想要读懂smali文件，首先要知道smali语法，大致可分为文件结构、寄存器声明规范、变量类型规范、指令格式，例如一段Java代码：
```
int a = 10;
try {
    callSomeMethod();
} catch (Exception e) {
    a = 0;
}
callAnotherMethod();
```

翻译成smali之后：
```
const/16 v0, 0xa

:try_start_0            # try 块开始
invoke-direct {p0}, Lnet/flygon/myapplication/SubActivity;->callSomeMethod()V
:try_end_0              # try 块结束

.catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :catch_0

:goto_0
invoke-direct {p0}, Lnet/flygon/myapplication/SubActivity;->callAnotherMethod()V
return-void

:catch_0                # catch 块开始
move-exception v1
const/4 v0, 0x0
goto :goto_0            # catch 块结束
```

可以看到smali代码不仅可以准确描述字节码指令，还十分方便阅读。


更多细节可自行学习或参考[文章](https://ctf-wiki.github.io/ctf-wiki/android/basic_operating_mechanism/java_layer/smali/smali/)

逆向smali的文件一个作用在于辅助代码逻辑审计，其次还可以通过将对方代码反编译回smali然后进行修改，例如if-else逻辑更改或者插入代码等，再编译回dex替换并重打包来实现对方APK的修改。

### ODEX和OAT
一般情况下，安卓系统在每次启动APP时会从中获取到 dex 文件并进行解释执行，但是每次都这样做，效率会比较低下。Android 开发者提出了一种方式，即我们最初加载 dex 文件时，就对其进行优化，生成一个 ODEX 文件，存放在 /data/dalvik-cache 目录下。当以后再次运行这个程序时，我们只需要直接加载这个优化过的 ODEX 文件就行了，省去了每次都要优化的时间。

但这是安卓4.4之前的做法，在安卓5.0之后，安卓引入了AOT（Ahead-Of-Time）静态编译机制，这种机制会在APK安装时进行优化生成oat文件，oat文件本质上是一种ELF文件，其中包含了原始dex和方法优化后的本地指令，如此一来，虚拟机可省去解释执行的步骤直接执行本地机器码来加快应用速度。但此种方式会导致应用安装时速度变慢，应用安装后更多的存储空间占用，而且系统一旦升级，那么所有的应用将要重新AOT，这个时间将会非常的漫长。

所以在安卓7.0之后，安卓继续进行了优化，引入了混合编译（AOT、解释执行和JIT）此时的AOT可以理解为All-Of-Time-Complication，此时APK在安装时不会进行预编译，APP的头几次运行会以解释模式执行方便快速启动，同时执行热度较高的代码则会被JIT，同时代码在执行期间被分析，分析结果保存在本地profile文件，当设备空闲或充电时才会根据这些profile文件进行预编译生成优化后的aot文件，优化过程包含了多种内联和优化，这些会导致某些方法可能无法被入口替换的方式hook（具体可以参见SandHook作者对ART invoke代码的生成的理解），总而言之，这种混合编译对当时基于入口替换的hook技术带来了新一轮的挑战和更新。

## 安卓虚拟机和JVM的区别
前面提到了安卓虚拟机和JVM在 执行文件格式上就有所区别，在字节码指令上两者也有着较大区别。

JVM中字节码指令采用的是零操作数形式，指令中的参数从求值栈（操作数栈）中读取，而安卓中虚拟机 面向移动设备，采用的则是二操作数或三操作数的形式，通过寄存器读取指令操作数。同样操作下，安卓虚拟机所需指令条数和内存访问次数更少。

> https://www.jianshu.com/p/8edac8e09b3e

## 加固与脱壳
可以看出APP在打包成APK之后，可以轻而易举的反编译出源代码，从而导致代码逻辑泄漏，为了防止APK被轻易破解，开始出现了加壳技术以及脱壳的对抗，加壳是指通过一个壳代码将原APP代码进行隐藏，在运行时才进行真正原APP代码的加载，其中演变出了各种加固技术，如落地壳、非落地壳、类抽取、VMP、Java2C等等。通常脱壳是逆向入门的第一步，但对于大型APP来说，加固势必会影响代码执行效率。

## Native层逆向
由于目前大多数的Java层混淆保护方案太过容易被破解，因此越来越多的厂商将关键代码逻辑通过C++实现，由JNI实现调用，因此逆向中还会涉及到Native层的逆向即SO（Linux下动态链接库）文件的逆向。

SO文件会根据不同的CPU架构有所差异，APP编译出的SO文件可在APK解压目录lib目录下不同CPU架构中找到。安卓中目前主流的是CPU架构是armeabi-v7a和arm64-v8a，对应32位和 64位的 arm，除此之外可能还有x86、x86_64或armeabi等不常见的架构。

这里给出Native层逆向已知的一些学习路径：
1. C++基础与安卓JNI开发
2. SO文件与ELF文件
3. SO文件格式（必备）
4. ARM常用汇编指令
5. IDA Pro使用和调试 
6. 花指令和ollvm
7. IDA的IDC/Python脚本编写

# 安卓基本组件和源码查看
有人说过，要想破解一个功能，首先要会开发一个功能。要想逆向安卓，还得对安卓开发中常用的组件API、系统机制有个大致的了解。这里列举目前遇到频率的一些安卓开发知识点。
- 四大组件Service\ContentProvider\Activity\BroadcastReceiver及其生命周期，其中Service服务机制和Activity非常重要，安卓中所有系统服务例如PMS、AMS等都是基于C/S模式通过binder通信，因此QContainer属于进程内hook，所以只能达到Client端的系统源码hook。其次Activity对应着安卓的页面展示，不论自动点击或者是通过页面布局定位关键代码都会用上。
- 安卓View体系及事件分发机制，需要知道常用的View类型及常用的方法，自动点击时可以用上。
- Binder机制，安卓中基于C/S模式的安全的仅需一次内存拷贝的跨进程通信机制，在Hook时注意Server端和客户端。
- Handler用法，线程间通信机制，开发中经常用到，因为安卓中不允许主线程进行耗时操作，且不能在子线程中进行UI操作，因此如何切换线程是开发和逆向必备技能。
- 源码阅读，逆向时候经常需要查看源码实现，一般可以在线源码查看，例如[xref](http://androidxref.com/)或者[androidos](https://www.androidos.net.cn/sourcecode)，再或者就是自己下载源码编译，例如《深入理解安卓ART虚拟机》中开篇提到的方式，这种方式需要占用200G左右磁盘空间。
- adb命令，adb命令是安卓自带的用于调试、分析和管理设备时所用到的经典工具，这里列举几个常用的命令：
  - adb logcat [-s xxx] 安卓查看日志命令，安卓中默认日志输出到控制台中就是通过该命令查看，可以根据不同的tag精准匹配进行筛选，**遇到插件导致APP崩溃时一定要先查看该日志，观察崩溃原因和堆栈**，由于默认日志会有很多，可以定位到崩溃时机上下查找。
  - adb shell dumpsys activity | grep mFocused -C 5 查看当前显示的activity名和包名
  - adb shell pm list package 输出当前设备中所有已安装的APP包名
  - adb pull/push 从设备中拉取文件到本地/从本地推送文件到设备中
  - adb shell am start -D -n 以debug模式启动特定的APP的特定activity
  - adb install/uninstall 安装/卸载app
