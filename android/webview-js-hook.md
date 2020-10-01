# JS Bridge
由于WebView中可以与原生APP世界进行交互，因此需要一个中间桥梁来建立两个世界的通信，这个思想也同样被应用于小程序当中。通过JsBridge可以完成在Java中调用Js方法，或者在JS中调用Java方法例如调试JS打印日志、回传报价等。

## JS中调用Java的代码
首先需要在Java中进行方法声明，有两种方式：
- @JavascriptInterface方法注解，但是存在安全漏洞
- WebView#addJavascriptInterface

## Java中调用JS的代码
两种方式：
- WebView#loadUrl 会导致刷新当前页面
- WebView#evaluateJavascript API19之后的方法

在调用之前不管哪种方式都需要进行设置允许执行JS代码：
```
WebSettings settings = mWb.getSettings();
settings.setJavaScriptEnabled(true);//允许相应js代码
```

整体上示例：
```
if (Build.VERSION.SDK_INT > 18) {
            mWb.evaluateJavascript("javascript:callJS()", new ValueCallback<String>() {
                @Override
                public void onReceiveValue(String value) {
                    Log.e("done", "onReceiveValue: " + value);
                }
            });
        } else {
            mWb.loadUrl("javascript:callJS()");
        }
```

# WebView Hook思路及方法
在WebView中进行Hook，一般目标都为获取请求结果或者是通过JS代码进行自动点击，这两种目标的实现核心都是通过JS注入进行Hook或执行自定义JS代码。

## 注入JS
通过上面的API描述，可以知道在WebView中可以轻松完成JS注入，例如通过:
- WebView#loadUrl
- WebView#evaluateJavascrip

并且注入时机也是可以有多种，如果想要在页面加载前或页面加载完成后进行注入，则可以通过WebViewClient所提供的onPageStarted等方法，若想要在页面加载中进行注入，则可以通过WebChromeClient#onProgressChanged中进行注入。

## Http请求结果获取
通过JS注入我们可以实现JS HOOK，例如在想要拦截Http请求结果时，我们可以Hook Ajax相关的接口获取数据，例如：
```
var realXhr = "RealXMLHttpRequest";

function hookAjax(proxy) {
    window[realXhr] = window[realXhr] || XMLHttpRequest;
    XMLHttpRequest = function () {
        var xhr = new window[realXhr];
        for (var attr in xhr) {
            var type = "";
            try {
                type = typeof xhr[attr]
            } catch (e) {
            }
            if (type === "function") {
                this[attr] = hookFunction(attr);
            } else {
                Object.defineProperty(this, attr, {
                    get: getterFactory(attr),
                    set: setterFactory(attr),
                    enumerable: true
                })
            }
        }
        this.xhr = xhr;
    };
    function getterFactory(attr) {
        return function () {
            var v = this.hasOwnProperty(attr + "_") ? this[attr + "_"] : this.xhr[attr];
            var attrGetterHook = (proxy[attr] || {})["getter"];
            return attrGetterHook && attrGetterHook(v, this) || v;
         };
    };
    function setterFactory(attr) {
        return function (v) {
            var xhr = this.xhr;
            var that = this;
            var hook = proxy[attr];
            if (typeof hook === "function") {
                xhr[attr] = function () {
                    proxy[attr](that) || v.apply(xhr, arguments);
                };
            } else {
                var attrSetterHook = (hook || {})["setter"];
                v = attrSetterHook && attrSetterHook(v, that) || v;
                try {
                    xhr[attr] = v;
                } catch (e) {
                    this[attr + "_"] = v;
                }
            }
        };
    }
    function hookFunction(fun) {
        return function () {
            var args = [].slice.call(arguments);
            if (proxy[fun] && proxy[fun].call(this, args, this.xhr)) {
                return;
            }
            return this.xhr[fun].apply(this.xhr, args);
        }
    }
    return window[realXhr];
};

hookAjax({
    responseText: {
        getter: tryParseJson2
    },
    response: {
        getter: tryParseJson2
    }
});
```

## JS自动点击
JS中也可以通过类似安卓中SuperAppium的方式来完成自动点击，而无需Appium等辅助，原理与SuperAppium相同，调用HTML中控件的响应API完成，而且更加简单，因为JS中还存在着天然的CSS选择器以及Xpath表达式选择document.evaluate，例如：
```
document.evaluate("//div[@class='v-calendar--date-month' and text()='{{checkYear}}年{{checkMonth}}月']/../ul/li/div[text()='{{checkDay}}']", document.body, null, XPathResult.ANY_TYPE, null).iterateNext().click();
```
通过document.evaluate和xpath表达式定位目标控件，通过js元素的api来完成click操作。