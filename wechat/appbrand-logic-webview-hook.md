# 小程序逻辑层Hook
在小程序每个页面加载时，微信会将当前页面的所有逻辑层JS代码通过V8引擎进行执行，因此，我们可以通过 Hook该方法来更改逻辑层的JS内容来完成JS注入和Hook。
```
        /**
         * 每个页面初始化加载时，都会将逻辑层的js代码组装由Native层传到逻辑层执行，因此可以Hook这个步骤替换一些关键Js代码
         */
        RposedHelpers.findAndHookMethod(WxHookConstants.logicJsEngineClass, loadPackageParam.classLoader, WxHookConstants.logicJsEngineExecuteJsMethod, "java.lang.String", "java.lang.String", int.class, "java.lang.String", "java.lang.String", "com.eclipsesource.v8.ExecuteDetails", new RC_MethodHook() {
            @Override
            protected void beforeHookedMethod(MethodHookParam param) throws Throwable {
                String js = (String) param.args[0];
                try {
                    for (JsHandler jsHandler : jsHandlers) {
                        if (jsHandler.support(js)) {
                            param.args[0] = jsHandler.handle(js);
                            break;
                        }
                    }
                } catch (Throwable e) {
                    Log.e(TAG, "hook logic layer js exception", e);
                }
            }
        });
```

#  渲染层Hook
小程序渲染层实际上就是个WebView，只不过微信有自定义的WebView，因此hook逻辑与WebView的Hook基本一致，例如我们可以通过WebViewClient来注入我们的JsBridge。
```
RposedHelpers.findAndHookMethod("com.tencent.xweb.WebView", SharedObject.loadPackageParam.classLoader, "setWebViewClient", "com.tencent.xweb.aa", new RC_MethodHook() {
            @Override
            protected void beforeHookedMethod(MethodHookParam param) throws Throwable {
                Log.i(TAG, "web view hook success");
                Object webView = param.thisObject;
                Object webViewClient = param.args[0];

                if (webViewClient == null) {
                    Log.i(TAG, "webViewClient is null");
                    return;
                }
                Log.i(TAG, "new webview onFinished");
                webViews.add(webView);
                RposedHelpers.callMethod(webView, "addJavascriptInterface", new JavaBridge(SharedObject.context), "javaBridge");
            }
        });
```

前面提到小程序开发者工具没有办法模拟登录，通过微信小程序登录 的时序图，我们可以知道主要是因为开发者工具没有办法获取到我们的登录code，该code是通过wx.login的api来获取。

![image](https://res.wx.qq.com/wxdoc/dist/assets/img/api-login.2fcc9f35.jpg)

只要我们能拿到真实环境中的wx.login所返回的cod，就可以在开发者工具中修改登录的代码，将wx.login注释，替换成我们的code，这样就可以完成开发者 工具中 的登录啦，因此我们可以在渲染层注入我们的js代码，来主动调用wx.login，获取登录cod，例如：
``
                // 在每个页面初始化完成之后注入
                RposedBridge.hookMethod(onPageFinishedMethod, new RC_MethodHook() {
                    @TargetApi(Build.VERSION_CODES.JELLY_BEAN_MR1)
                    @Override
                    protected void afterHookedMethod(MethodHookParam param) throws Throwable {
                        if (!isWxLogined.compareAndSet(false, true)) {
                            return;
                        }
                        Object webView = param.args[0];
                        String url = (String) RposedHelpers.callMethod(webView, "getUrl");
                        Log.i(TAG, "webview:" + url);
                        // 调用wx.login
                        RposedHelpers.callMethod(webView, "loadUrl", "javascript:" + "wx.login({success: function(res){wx.showToast({title:res.code,icon:'none',duration: 2000});javaBridge.log(res.code);},fail:function(e){wx.showToast({title: '登录失败', icon: 'none', duration: 2000});javaBridge.log('登录失败');}});");
                    }
                });
```