# 入门JS逆向
在逆向JS和逆向Java时会有几个明显的差异感受：
* JS调试方便，能够Debug，工具链简单，通常只需chrome，或者加上抓包工具和chrome插件作中间人攻击的JS注入
* JS的弱类型和语法多样性，各种闭包、逗号表达式等语法让可读性不如Java顺畅
* JS逆向不需要太多虚拟机知识，但同样需要很多耐心

# JS算法还原常用的三种方式
JS逆向的目标就在于对方请求协议或关键参数的还原，与APP逆向类似，这里总结了市面上常见的几种JS破解方案供选择：

破解方案 | 适用场景 | 特性 | 业务使用DEMO
---|---|---|---
白盒还原| 适用于简单的未混淆JS，加密算法简单或者为标准的AES、RSA等 | 完全掌控对方JS，可直接翻译为Java，但还原过程需要人工分析，耗时可能较长 | 美团Touch周边游景点详情页接口破解
Node还原 | 对方JS加密算法复杂、无法剥离，但是加密过程与设备指纹或用户信息无关 | 与rpc调用方式适用场景类似，但实现比RPC复杂，需要模拟浏览器环境，但优点在于可直接移植到JVM中执行，无需维护实体浏览器和其他角色 | 携程eleven参数
RPC调用 | 对方JS加密算法复杂、无法剥离，但是加密过程与设备指纹或用户信息无关 | 不关注对方运行过程，直接通过RPC方式调用，破解快速，但交互链路涉及多个系统，且需保证实体浏览器存活 | 暂无
浏览器自动化技术 | 适用于无法破解的情况，例如支付宝支付 | 最接近真人行为，但是存在很多自动化痕迹（可绕过）| 支付宝Touch模拟支付

上述三种破解方案各有不同的使用场景和优缺点，在破解难度上依次降低，使用时可以根据破解时间、JS分析难度、风控难度进行选择。

# 风骚的JS语法必知必会
## 闭包
https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Closures

了解闭包对于JS逆向的好处在于可以快速溯源某个参数的执行路径和来源，因为在实际JS中会遇到许多闭包手法。

## 逗号表达式
对它的每个操作数求值（从左到右），并返回最后一个操作数的值。

JS中最常用的语法，例如在返回结果时使用，但我们只需关注逗号表达式中最后一个参数或表达式结果。

## 原型(Prototype)和原型链
由于JS Prototype的存在，JS天然存在Hook技术，无需像安卓一样基于方法入口替换或者inline hook等技术去实现Method Hook。

## Node.JS
在我们的Node还原破解方案中，其中关键一步就是将浏览器环境的JS移植到Node环境中，由于NodeJS采用的内核也为V8引擎，因此这步成功之后，就可保证在Java中通过V8引擎调用对方JS的可行性。同时由于Node没有界面渲染，因此在浏览器中可使用的例如window、navigator、dom等操作在node是不存在的，因此所以对于NodeJS的环境搭建和浏览器环境补齐也是JS逆向需要掌握的。

# Chrome调试技巧
Chrome作为JS逆向的核心工具，熟练掌握Chrome的控制台、插件编写就已经足够应付绝大多数的抓包、JS调试/断电、Js Hook。

## 常用小技巧
- Sources面板的breakpoint功能
- console.table打印数组
- copy()复制到剪切板
- Snippets代码片段
- debugger 下断点，JS支持通过debugger();来下断点，例如可能会遇到一种反调试措施就是打开控制台时无限跳入debugger就是通过该方法。


## Sources面板的breakpoint功能
在Sources面板的右侧有非常实用的XHR BreakPoints和其他DOM元素、事件的断点功能，通过XHR断点可以快速在目标接口请求时debug住，然后通过调用栈回溯其中某个参数的生成逻辑。例如：
![image](http://oss.alienhe.cn/20200916130010.png)

## DOM元素变更监听
其他例如DOM元素变更的监听断点功能可以用于监听页面上某个组件的值发生变更时自动下断点，具体可以先在Element面板中找到对应元素组件，然后右键源代码 -> brean on -> attribute modifications。

## DOM元素事件绑定函数定位
如果想要找到目标元素组件的点击事件所绑定的事件函数例如onClick函数，可以同样在Elements面板中找到对应元素后，在右边部分点击Event Listeners找到该元素绑定的所有事件。例如：
![image](http://oss.alienhe.cn/20200916115036.png)

# JS注入及Hook
安卓的逆向基础在于Hook，在JS中也会需要用到Hook技术，例如当想分析某个Cookie是如何生成时，如果想通过直接从代码里搜索该Cookie的名称来找到生成逻辑，可能会需要审计非常多的代码。我们都知道JS Cookie设置都是通过document.cookie=xxx来赋值，这个时候，如果有一种JS HOOK技术，能够hook document.cookie的set方法，那么我们就可以通过打印当时的调用方法堆栈或者直接下断点来定位到该cookie的生成代码位置。

前面提到JS原型Prototype天然支持Hook，通过原型我们可以更改对象的字段、方法属性，因此我们可以通过重写document.cookie的get/set方法来hook cookie：
```
// 注意缓存原来的cookie
var cookie_cache = document.cookie ? document.cookie : "";
Object.defineProperty(document, 'cookie', {
        get: function() {
            console.log('Getting cookie:'+this._value);
            return cookie_cache;
        },
        set: function(val) {
            console.log('Setting cookie', val);
            debugger;
            var cookie = val.split(";")[0];
            var ncookie = cookie.split("=");
            var flag = false;
            var cache = cookie_cache.split("; ");
            cache = cache.map(function(a){
                if (a.split("=")[0] === ncookie[0]){
                    flag = true;
                    return cookie;
                }
                return a;
            })
            cookie_cache = cache.join("; ");
            if (!flag){
                cookie_cache += cookie + "; ";
            }
            this._value = val;
            return cookie_cache;
        },
    });
```

通过上述的代码可以完成JS Hook的操作，但是又要如何去修改的对方JS代码呢？如果说我们需要Hook的方法调用时机是在页面已经加载完成后，我们甚至可以通过控制台来执行我们的hook脚本，但是绝大多数情况下，我们所需要hook的方法的时机都是在页面加载时调用的，因此我们需要一个在对方JS执行之前加载我们的Hook脚本。这里提供三种方案供选择：
- Charles抓包并断点，在response中手动添加我们的js在html开头处
- [ReRes插件](https://github.com/annnhan/ReRes)重定向JS文件，将对方的html重定向至我们本地的修改后附带hook脚本的html
- 油猴脚本的方式（推荐，最方便）

后两种实际上都是通过Chrome插件的方式来完成JS注入，在熟练之后我们也可以自己编写Chrome插件工具来完成JS注入和Hook和加快分析速度。这里介绍一下油猴脚本的编写方式，使用方式可见：

https://sspai.com/post/40485

## 油猴脚本示例

@run-at document-start意思为在document加载时进行注入脚本
```
// ==UserScript==
// @name         Hook global
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  hook cookie get/set方法
// @author       alienhe
// @include      *
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    var cookie_cache = document.cookie ? document.cookie : "";
    Object.defineProperty(document, 'cookie', {
        get: function() {
            console.log('Getting cookie:'+this._value);
            return cookie_cache;
        },
        set: function(val) {
            console.log('Setting cookie', val);
            debugger;
            var cookie = val.split(";")[0];
            var ncookie = cookie.split("=");
            var flag = false;
            var cache = cookie_cache.split("; ");
            cache = cache.map(function(a){
                if (a.split("=")[0] === ncookie[0]){
                    flag = true;
                    return cookie;
                }
                return a;
            })
            cookie_cache = cache.join("; ");
            if (!flag){
                cookie_cache += cookie + "; ";
            }
            this._value = val;
            return cookie_cache;
        },
    });
})();
```
# [实战案例-美团周边游景点详情页接口](/js/美团Touch周边游景点详情页接口破解.pdf)