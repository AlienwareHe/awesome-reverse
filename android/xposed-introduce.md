# Xposed安装时做了什么手脚
- 将 xposed 版的 app_process 拷贝到/system/bin/，系统原来的 app_process 改名为 app_process.orig
- 将 XposedBridge.jar 放到/data/data/de.robv.android.xposed.installer下
- 删除/data/data/de.robv.android.xposed.installer/conf/disabled文件。如果有 disabled 文件则表明整个 Xposed 功能被禁止使用。

Xposded将zygote进程进行了替换，由于所有app进程 都由zygote孵化而来，因此便完成了所有app的进程注入。

## app_process
app_process是一个脚本文件，也是zygote进程的源代码，因此app_process涉及了安卓系统的启动流程。

## 安卓系统启动流程
Android 系统启动过程由内核到App的从下向上的一个过程，由Boot Loader引导开机，然后依次进入Kernel -> Native-> Framework-> App。

### 开机
* Boot ROM：当手机处于关机的状态，长按Power键开机，引导芯片从固化在ROM里预设的代码开始执行，然后加载程序到RAM
* Boot Loader：这是启动Android系统之前的引导程序，主要是检查RAM，初始化硬件参数等工能

### 用户态的第一个进程init
Linux系统的用户进程，是所有用户进程的鼻祖，进程号为1，它有许多重要的职责，比如创建Zygote孵化器和属性服务等。并且它是由多个源文件组成的，对应源码目录system/core/init中。

### Android中的第一个Java进程Zygote
Linux系统启动后，内核将读取/init.rc文件，并启动该文件中定义的各种服务程序，例如zygote。zygote进程对应的代码就是app_process，位于/system/bin/目录下。

```
# init.rc文件部分
service zygote /system/bin/app_process -Xzygote /system/bin –zygote –start-system-server

socket zygote stream 666 (zygote socket服务端口)

onrestart write /sys/android_power/request_state wake
onrestart write /sys/power/state on
onrestart restart media
onrestart restart netd
```



System Server 进程，是由Zygote fork而来，System Server是Zygote孵化出的第一个进程，System Server 负责启动和管理整个Java FrameWork，包含ActivityManagerService， WorkManagerService，PagerManagerService，PowerManagerService等服务

Media Server 进程，是由init fork而来，负责启动和管理整个C++FrameWork，包含AudioFlinger，Camera Service等

### APP进程
![经典流程图](http://oss.alienhe.cn/20200816174922.png)
* App发起进程：如果从桌面启动应用，则发起进程便是Launcher所在的进程，当从某App启动远程进程，则发起进程是App所在的进程，发起进程首先需要通过Binder发送信息给system_server进程
* system_server进程：调用Process.start方法，通过Socket向Zygote进程发送新建进程的请求
* zygote进程：在执行ZygoteInit.main()后进入runSelectLoop()循环体，当有客户端连接时，便会执行ZygoteConnection.runOnce()方法，再经过层层调用后fork出新的应用进程
* 新进程：执行handleChildProc方法，设置进程名，打开binder驱动，启动新的binder线程，设置art虚拟机参数，反射目标类的main方法，即调用ActivityThread.main()方法

## Xposed插件安装 
xposed 插件，在 xposed 世界里我们说它是插件，但是放到 Android 世界里它就是一种特殊的 APP。这种类型的 APP 由 xposed 框架识别并加载，然后 hook 到其他的 App 进程。

## 如何识别Xposed插件
在xposed_bridge.jar中，有一个类ModuleUtil，其中reloadINstalledModules函数就是负责加载插件。该函数会遍历所有已安装应用的meta data信息即AndroidManifest.xml中meta-data标签，通过判断以下三个标识来判断是否是xposed插件：
*  name = xposedmodule
*  name = xposeddescription
*  name = xposedminversion

## 如何加载Xposed插件

通过这部分源码我们可以对xposed进行两个改造：
* 免重启加载Xposed插件
* 免安装加载Xposed插件

### Xpoosed原加载机制
正常的Xposed在插件安装或者修改之后，都需要重启系统才能使新插件生效 ，原因就是Xposed是在app_process中一次性将模块列表读取，然后将其入口类放在一个Set集合中，待到应用启动的时候再分别调用每个handleLoadPackage，之后就不再读取插件。因为这样，所以每次fork之后，插件已经被加载在内存中了，就算更新插件也不会被读取加载，所以必须得重启才能使得插件生效。
```
// de.robv.android.xposed.XposedBridge#main()
protected static void main(String[] args) {
    ...
        if (isZygote) {
            XposedInit.hookResources();
            XposedInit.initForZygote();
        }
 
        XposedInit.loadModules();
    ...
}
```

### Xposed免重启加载机制
如果跟着XposedBridge#main方法开始一直跟踪，可以看到默认的Xposed在刚开始就进行了模块加载：
> XposedInit.loadModules();

导致插件重新安装后必须重启手机才能触发模块重新生效，如果想要做到免重启的效果，那么我们需要在每次目标APP重启时触发模块的加载,继续看代码可以发现Xposed通过HookhandleBindApplication来hook每个应用进程的创建，所以只要在这个时候再loadModules就可以啦。

### Xposed如何实现对方法的Hook
由于DVM和ART上方法实现不一致，因此分析原理时需要针对不同系统版本具体区分，但大致原理上可以简述为：

修改目标方法为JNI方法，并替换方法结构体中本地指令的入口点，类似GOT表Hook原理，但可能存在由于方法直接跳转不走入口点查询导致hook遗漏的问题。

dvm中：

- 根据slot（Method对象偏移）获取Method结构体指针 ，
- 创建XposedHookInfo结构体，用于保存原方法信息和hook信息（additionalHookInfo，包含hook callback，参数类型和返回类型）
- 将原方法设置为native方法，
- 将原方法nativeFunc设置为hookedMethodCallback指针，
- 将原方法insns字段设置为hookInfo结构体
- 重置JIT cache，防止方法被JIT

art中：

- 根据Method调用ArtMethod:FromReflectedMethod返回方法对应的ArtMethod对象
- 把Method对象，方法额外信息和原始方法保存至XposedHookInfo结构体中防止JIT编译
- 并调用SetEntryPointFromJni()把这个结构体变量的内存地址保存在ArtMethod对象中
- SetEntryPointFromQuickCompiledCode(GetQuickProxyInvokeHandler)
- 调用SetAccessFlags((GetAccessFlags() & ~kAccNative & ~kAccSynchronized) | kAccXposedHookedMethod)来完成标志位的清除（设置Fast_jni模式）
- 将原方法的 CodeItem偏移设置0，因为已经是native方法了

# 参考
* https://www.infoq.cn/article/android-in-depth-xposed
* https://bbs.pediy.com/thread-257844.htm
* https://bbs.pediy.com/thread-223713.htm