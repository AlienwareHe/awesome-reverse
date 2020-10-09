# 目录

* [简介](README.md)
* [工具环境](/base/tools-and-environment.md)
* JS逆向
    * PC/H5
        * [未混淆的JS调试和算法还原](/js/js-reverse-entry.md)
        * Node环境模拟执行JS
            * [浏览器环境补齐](/js/browser-env-fix.md)
            * [JDK中V8引擎和Nashorn引擎使用](/js/jvm-js-execute-engine.md)
        * [OB混淆的AST还原-待续]()
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
    * [关键代码定位技巧](/android/keycode-locate-tips.md)
    * [QContainer中的Hook](/android/QContainer-hook.md)
    * QContainer项目解析
        * [重打包机制及签名校验绕过](/qcontainer/qcontainer-patch.md)
        * [感染脚本开发解析](/qcontainer/container-builder.md)
        * [IO重定向的实战应用](/qcontainer/qcontainer-io-relocate.md)
        * [客户端设备指纹模拟](/qcontainer/device-fingerprint.md)
        * [QContainer中的native hook](/qcontainer/qcontainer-native-hook.md)
        * [定时调度框架原理解析](/qcontainer/qconatiner-scheduler.md)
        * [插件热发更新原理](/qcontainer/qcontainer-hotplugin.md)
    * [基于Hook的自动化点击框架](/android/xposed-appium.md)
    * [APP接口暴露式RPC调用](/android/hook-rpc.md)
    * [APP的全协议还原过程的抽丝剥茧](/android/crack-mt-tcp.md)
    * [基于Hook的携程美团TCP请求抓包](/android/mt-ctrip-hook-capture.md)
* 安卓逆向进阶
    * [基于FRIDA分析逆向APP](/frida/frida-docs.md)
    * [安卓加固历代壳发展及对应脱壳技术](/android/apk-unpack.md)
    * [IDA Pro常用分析手法-待续]()
    * [ARM常用指令及参数调用约定-待续]()
* [面试招人及审核标准-待续]()
