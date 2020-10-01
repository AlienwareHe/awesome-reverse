# 安卓微信小程序逆向
# 逆向准备
在开始破解微信小程序之前，最好先浏览一遍微信的[小程序开发者文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)，通过开发者文档可以了解到小程序的：
- 编写语言仍然主要是JS，但运行环境不同，与浏览器环境和Node环境有所区别
- 代码结构/目录/文件，与HTML类似，小程序中也有类似WXML、WXSS等模版和样式文件
- 小程序宿主环境（安卓逻辑层使用V8内核），以及渲染层和逻辑层的区别 
- 小程序常用API
- 微信开发者工具的使用，通过微信开发者工具可以运行小程序反编译的代码进行调试

通过这些，才能知道获得小程序的编译产出物并进行反编译之后，如何下手和读懂小程序代码，进而进一步定位和提取关键逻辑。

# 逆向步骤
在逆向APP时，一般先反编译代码，然后各种方式定位关键代，在小程序中也是如此，只不过小程序的反编译方式与定位方式有所不同：
- 获取小程序源码并反编译
- 打开微信开发者工具进行修复
- 抓包、调试、代码审计

# 小程序架构浅析
小程序开发文档中有一张非常重要的图描述了小程序的运行环境，通过这个图我们可以知道：
- 小程序中页面展示渲染（即渲染层）与我们所看到的小程序JS文件（即逻辑层）并不运行在同一个JS环境
- 视图view层在webview中渲染，一个页面对应一个webview
- 小程序中所有的网络通信能力HTTP/WebSocket最终都是通过微信客户端来完成
- 渲染层存在多个WebView线程，逻辑层与渲染层的通信也会经由微信客户端做中转

![image](https://res.wx.qq.com/wxdoc/dist/assets/img/4-1.ad156d1c.png)

整个小程序框架系统分为两部分：逻辑层（App Service）和 视图层（View）。小程序提供了自己的视图层描述语言 WXML 和 WXSS，以及基于 JavaScript 的逻辑层框架，并在视图层与逻辑层间提供了数据传输和事件系统，让开发者能够专注于数据与逻辑。

小程序这样设计的优点也在于视图渲染与业务逻辑分别在运行在不同的线程中，防止长时间的脚本运行导致渲染白屏卡死等，

因此在逻辑层中是不存在DOM等操作，也无法控制小程序展示页面，所以如果在小程序JS注入时需要注意这点。

# WAService.js和WAWebview.js
在反编译小程序源码之后可以看到两个与业务无关的JS文件，WAService.js和WAWebview.js，这俩文件其实是微信的基础开发库，微信宿主环境会提前内置基础库，打开小程序时会自动将基础库注入到小程序的视图层和业务逻辑层中，小程序开发者工具则是由底层HTTP服务负责注入。

WAService负责提供逻辑层 基础功能，例如：
- WeixinJSBridge：消息通信的统一封装易于调用，主要微信环境与native，开发环境与开发者工具后台服务的通信。
- wx: wx对象下面的api方法封装
- appServiceEngine：定义了全局的方法如define，require, App，Page，Component，getApp，getCurrentPages等
- virtualDOM: VirtualDOM，Diff和Render UI实现
- expraser: expraser框架组件的方法定义，这意味着逻辑层也具有一定的组件树组织能力。
- Reporter: 小程序日志组件

WAWebview负责提供渲染层基础功能 ，例如：
- 消息通信封装为WeixinJSBridge
- 日志组件Reporter封装
- wx对象下的api，跟WAService里的不同的是其大部分都是处理UI显示相关的方法
- 小程序Expraser组件框架的实现和内置组件的注册
- VirtualDOM，Diff和Render UI实现
- 定义页面相关事件触发

可以发现，与WebView类似，在Native和JS通信时都是利用了中间层JsBridge来完成过通信，在小程序启动时微信会分别向逻辑层和渲染层中注入该WeixinJsBridge，WeixinJsBridge提供了四个方法，这四个方法完成了双线程之间的通信机制。
```
window.WeixinJSBridge = { 
  on: o,//on: 用来收集小程序触发的事件回调
  invoke: a, //invoke：以api方式调用微信客户端的基础能力，并提供对应api执行后的回调
  publish: c, //publish：用来向Appservice业务层发送消息，也就是说要调用Appservice层的事件方法
  subscribe: u //subscribe: 用来收集Appservice业务逻辑层触发的事件回调
 }
```

因此，我们可以在Java层中找到WeixinJsBridge注册的这四个方法进行Hook，来监控或控制WeixinJsBridge，比如publish方法可以参考ratel_qunar_crack项目中crack-dianping-mini-tx插件的com.alienhe.crack_dianping_mini_tx.wxium.WxJsBridgeHooker。
