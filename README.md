# 简介
主要总结个人学习逆向相关所遇到的一些技术知识点和路径，因为逆向这个技术栈没有系统的规划路径，所以想要将工作中所遇到的和面试到的一些相关知识总结，面向逆向新人提供一些微薄的帮助。

本项目将会随着我的学习和进步一直更新～
# 目录
* [工具环境](/base/tools-and-environment.md)
* JS逆向
    * PC/H5
        * [未混淆的JS调试和算法还原](/js/js-reverse-entry.md)
        * Node环境模拟执行JS
            * [浏览器环境补齐](/js/browser-env-fix.md)
            * [JDK中V8引擎和Nashorn引擎使用](/js/jvm-js-execute-engine.md)
        * [OB混淆的AST还原](/js/js-obfuscator.md)
    * 安卓WebView
        * [WebView Hook](/android/crack-webview.md)
        * [JS Bridge注入](/android/webview-js-hook.md)
    * 微信小程序
        * [小程序架构解析](/wechat/appbrand-framework-introduce.md)
        * [小程序反编译及代码修复](/wechat/appbrand-compile.md)
        * [渲染层和逻辑层的两种Hook方式](/wechat/appbrand-logic-webview-hook.md)
        * [小程序网络请求Hook](/wechat/appbrand-request-hook.md)
* 安卓逆向入门
    * [安卓基础知识](/android/android-base-knowledge.md)
    * [Xposed Hook入门](/android/xposed-hook-simple.md)
    * [Xposed 原理简单介绍](/android/xposed-introduce.md)
    * [关键代码定位技巧](/android/keycode-locate-tips.md)
    * [QContainer中的Hook](/android/QContainer-hook.md)
    * [重打包机制及签名校验绕过](/qcontainer/qcontainer-patch.md)
    * [客户端设备指纹模拟](/qcontainer/device-fingerprint.md)
    * [QContainer中的native hook](/qcontainer/qcontainer-native-hook.md)
    * [基于Hook的自动化点击框架](/android/xposed-appium.md)
    * [APP接口暴露式RPC调用](/android/hook-rpc.md)
    * [APP的全协议还原过程的抽丝剥茧](/android/crack-mt-tcp.md)
    * [基于Hook的MT和Ctrip的TCP请求抓包](/android/mt-ctrip-hook-capture.md)
    
* 安卓逆向进阶
    * [面试必问：ELF文件格式](/so/elf-study.md)
    * [基于FRIDA分析逆向APP](/frida/frida-docs.md)
    * [安卓加固历代壳发展及对应脱壳技术](/android/apk-unpack.md)
    * [ARM常用指令及参数调用约定](/so/arm-registers.md)
    * [IDA Pro常用分析手法-待续]()

# 交流
作者微信：hx58929

作者故事星球：

![一起来讨论交流学习吧，逆向人！](/assets/677.jpeg)

如果你觉得对你有帮助，或者你开心的话，可以请作者喝一杯咖啡：

![wx](/assets/wx.jpeg)
![zfb](/assets/zfb.jpeg)

# 致谢
感谢所学到的所有逆向前辈！