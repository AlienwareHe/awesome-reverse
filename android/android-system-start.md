之所以会问这个问题，个人理解主要是可以衍生出考察下列几个问题：

* 安卓系统中第一个用户态进程是什么
* zygote进程有何意义，从何而来
* 为什么Xposed进程选择修改app_process
* riru是如何实现zygote进程注入
* system_server进程是什么
* binder机制中Native层的ServiceManager如何而来
* 安卓启动架构：Bootloader -> Kernel -> Native -> FrameWork -> App

首先来看看大致的安卓系统开机流程。
* 按下电源键
* BootLoader引导程序启动
* 用户态第一个进程：init进程
* init进程解析init.rc并fork出zygote进程 
* zygote进程fork出system server进程

# 安卓系统架构
安卓启动架构与Google的经典五层架构十分类似，下图 是从进程的视角来划分：
![安卓启动架构图](http://oss.alienhe.cn/20200904091334.png)

## init进程
init进程是用户态的第一个进程（pid=1），除了会孵化出adbd等守护进程，还启动了ServiceManager（Binder的管家），bootanim（开机动画）等重要服务，同时init 进程还孵化除了Zygote进程，Zygote进程是Android中的第一个Java进程（即虚拟机进程），Zygote是所有Java进程的父进程。

这里ServiceManager进程的创建又涉及到了安卓中极为重要的 Binder机，待下回详细分解。


## Zygote进程
Zygote进程是Java世界 的第一个进程，所有APP的启动都是通过zygote进程而来，更详细点就是zygote进程会通过监听某个本地端口获取待启动APP的需求，然后fork自身。具体可看 APP的启动流程。

### init进程如何启动Zygote进程
查看init进程的入口函数system\core\init\init.cpp的main方法可以看到有一句解析init.rc文件的代码。

> init.rc文件是使用Android 初始化语言（Android init Language）编写的脚本。

在init.rc文件中有一行用于启动Zygote进程：
```
service zygote /system/bin/app_process32 -Xzygote /system/bin --zygote --start-system-server --socket-name=zygote
    class main
    priority -20
    socket zygote stream 660 root system
    onrestart write /sys/android_power/request_state wake
    onrestart write /sys/power/state on
    onrestart restart media
    onrestart restart netd
    writepid /dev/cpuset/foreground/tasks /sys/fs/cgroup/stune/foreground/tasks
 
service zygote_secondary /system/bin/app_process64 -Xzygote /system/bin --zygote --socket-name=zygote_secondary
    class main
    priority -20
    socket zygote_secondary stream 660 root system
    onrestart restart zygote
    writepid /dev/cpuset/foreground/tasks /sys/fs/cgroup/stune/foreground/tasks
```
从这行脚本可以看出：
* 启动这个zygote service的可执行文件路径：/system/bin/app_process32
* 启动这个service的参数
* 监听了某个套接字端口
* class main 指的是zygote 的 classname 为 main

Zygote是以service配置的，所以当解析该完成时，init进程就会调用fork去创建Zygote进程，并且执行app_main.cpp文件中的main函数，作为Zygote进行的启动入口。该函数主要对init.rc中传入的参数进行解析，以及调用AppRuntime#start方法调用ZygoteInit完成Zygote进程启动。
> runtime.start("com.android.internal.os.ZygoteInit", args, zygote)

AppRuntime继承自AndroidRuntime，主要作用就是：
1. 启动了JVM
2. 为JVM 注册了JNI 方法
3. 解析参数，得到对应的类，执行这个java类中的main方法

由此就开始执行ZygoteInit.java，开始进入Java的世界。ZygoteInit.java主要做了以下事情：
1. 创建server端的Socket,名称为 ANDROID_SOCKET_zygote。
2. 预加载类和系统资源
3. 启动system_server进程
4. runSelectLoop 用于等待 后续AMS创建新的应用进程，和其进行通信

由此也可以窥探出APP启动流程中为什么所有APP进程都由Zygote进程孵化而来。



##  System Server进程
在安卓中有许多基于Binder的Service服务，例如ActivityManager、PackageManager等等，这些服务的创建就是由Zygote fork而来，System Server是Zygote孵化出的第一个进程，System Server 负责启动和管理整个Java FrameWork，包含ActivityManagerService， WorkManagerService，PagerManagerService，PowerManagerService等服务。

那么这里还可以衍生出安卓系统的Services机制就是，Zygote进程在创建出这些系统服务之后，又是如何注册让各APP进程调用的呢？

## Xposed为什么要修改app_process
众所周知，Xposed之所以可以实现hook的原因是修改了app_process将自己的代码注入到了Zygote进程，相当于完成了Zygote进程的替换，那么app_process是什么东西呢？

实际上，app_process就是Zygote进程对应的可执行文件。

## riru是如何实现zygote进程注入
riru是一个只需要修改一个系统文件就可以达到全局注入的模块。
> riru: https://github.com/RikkaApps/Riru

riru采取的做法不是替换app_process，因为这样改动成本太大，因此riru的想法是找到一个会在app_process执行过程中加载的so库文件，但是该so库文件尽量小，然后替换该so库文件来实现zygote全局注入。

所以riru找到libmemtrack.so，该so只有十个导出 函数，修改起来会比较简单。

其次riru为了监控应用进程和的启动，riru 替换了两个JNI函数（com.android.internal.os.Zygote#nativeForkAndSpecialize & com.android.internal.os.Zygote#nativeForkSystemServer），这两个JNI函数会在zygote进程被fork时调用，至于如何替换则是通过hook libandroid_runtime.so对jniRegisterNativeMethods方法（来自libnativehelper.so）的调用，这样就能拦截一部分的JNI方法调用了。为什么说是一部分？因为另一部分JNI函数的实现在libart里，这一部分函数直接通过env->RegisterNativeMethods完成注册，所以无法hook。

之后riru在被替换的jniRegisterNativeMethods中动了一点小手脚：如果正在注册来自Zygote类的JNI方法，那么会把nativeForkSystemServer和nativeForkAndSpecialize替换成自己的实现，这样就能拦截system_server与应用进程的启动了！



## 不通过替换系统so文件进行全局注入的一种方式 
在app_process源码中，有这样一段逻辑：
1. 读取/system/etc/public.libraries.txt和/vendor/etc/public.libraries.txt
2. 挨个dlopen这两个txt文件里提到的所有so库
因此，只要把我们自己写的so库扔到/system/lib下面（64位是/syste/lib64），然后在/system/etc/public.libraries.txt里把我们自己的文件加上去，这样zygote启动的时候就会去加载我们的so库，然后我们写一个函数，加上__attribute__((constructor))，这样这个函数就会在so库被加载的时候被调用，我们就完成了注入逻辑；而且这个文件是一个txt文件，只需要追加一行文件名就行，即使厂商做了修改也不用担心。

```
看雪还有两篇全局注入的方法:
https://bbs.pediy.com/thread-217587.htm
https://bbs.pediy.com/thread-224191.htm
```

# 参考：
* https://blog.csdn.net/UserNamezhangxi/article/details/86762219
* https://juejin.im/post/6844903929369608206#heading-6
* https://blog.canyie.top/2020/02/03/a-new-xposed-style-framework/
* https://juejin.im/post/6887456044760039438