一般情况下，安卓WebView可能存在几种破解目标：
1. 破解对方APP中的WebView
2. 破解Touch中的网页，例如手机上浏览器中可以打开的网页

第二种方式下，一般可通过直接破解JS来完成协议抓取，但也可以将对方的Touch页面直接放入我们开发的简易WebView 浏览器APP中，相当于将对方的运行环境变成我们可操控的运行环境。例如之前点评Touch配合点击的抓取项目。这种方式相比直接破解JS协议的优点在于无需关注对方算法还原，可快速获取到数据，但缺点同样在于设备的指纹信息，虽然浏览器环境中可获取的设备信息较少，但仍是需要进行一定分析和模拟，因此这种方式适用于配合自动点击、对方算法难度高，但指纹难度低或风控弱的情况。

第二种方式是在对安卓WebView技术开发有一定的基础上，配合一定的逆向思维和WebView所提供的API来完成调试和逆向。实际在第一种方式中破解WebView中用到的技术于之类似，只是需要通过Hook框架来完成代码的注入，而第二种方式由于APP是自己开发的，所以可以随心所欲定制代码而无需注入。

# WebView开发技术
Android WebView在Android平台上是一个特殊的View， 基于webkit引擎、展现web页面的控件，这个类可以被用来在你的app中仅仅显示一张在线的网页，还可以用来开发浏览器。WebView内部实现是采用渲染引擎来展示view的内容，提供网页前进后退，网页放大，缩小，搜索。Android的Webview在低版本和高版本采用了不同的webkit版本内核，4.4后直接使用了Chrome。通过WebView可以完成以下几种功能：
1. 通过外部URL加载网页，例如浏览器
2. 加载本地资源中的HTML文件
3. 和原生Native APP进行交互，例如Hybrid混合开发技术

因此WebView(android.webkit.WebView)只是一个View，而不是Activity，与TextView等一样需要依赖Activity来完成布局。因此在分析APP时仍然需要首先找到Activity对应的类。

## 常用API
### android.webkit.WebView
核心类，负责创建对象和加载URL/资源文件等，其中还有一些非常重要的方法，包括：
- setWebContentsDebuggingEnabled 静态方法，用于设置远程调试WebView
- loadUrl 加载url地址，可以是www链接，可以是本地文件路径或者HTML/JS代码片段
- loadData 加载HTML代码片段
- goBack/goForward 操作网页后退前进
- setWebChromeClient 设置WebChromeClient，主要辅助WebView处理Javascript的对话框、网站图标、网站title、加载进度等
- setWebViewClient 设置WebViewClient，主要帮助WebView处理各种通知、请求事件的
- addJavascriptInterface 添加JS方法，用于在JS中调用Java世界的方法
- evaluateJavascript Java中调用JS中的方法/脚本的一种方式
- getSettings 获取WebSettings对象，用于配置和管理WebView

### android.webkit.WebSettings
- setJavaScriptCanOpenWindowsAutomatically(true);//设置js可以直接打开窗口，如window.open()，默认为false
- setJavaScriptEnabled(true);//是否允许执行js，默认为false。设置true时，会提醒可能造成XSS漏洞
- setSupportZoom(true);//是否可以缩放，默认true
- setBuiltInZoomControls(true);//是否显示缩放按钮，默认false
- setUseWideViewPort(true);//设置此属性，可任意比例缩放。大视图模式
- setLoadWithOverviewMode(true);//和setUseWideViewPort(true)一起解决网页自适应问题
- setAppCacheEnabled(true);//是否使用缓存
- setDomStorageEnabled(true);//DOM Storage

### android.webkit.WebViewClient
- onPageFinished 页面请求完成
- onPageStarted 页面开始加载
- shouldOverrideUrlLoading 拦截url
- onReceivedError 访问错误时回调，例如访问网页时报错404，在这个方法回调的时候可以加载错误页面。

### android.webkit.WebChromeClient
- onJsAlert webview不支持js的alert弹窗，需要自己监听然后通过dialog弹窗
- onReceivedTitle 获取网页标题
- onReceivedIcon 获取网页icon
- onProgressChanged 加载进度回调，如果要进行JS注入的自动点击，这个方法是比较好的注入时机。

# WebView远程调试
1. 在应用中开启WebView远程调试：setWebContentsDebuggingEnabled
2. 设备USB连接电脑，打开chrome，输入chrome://inspect
3. 在Devices中可以看到对应的设备的WebView