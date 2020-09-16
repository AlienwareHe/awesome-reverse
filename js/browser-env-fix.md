# 浏览器环境补齐和浏览器指纹
![携程eleven参数中需要补齐的浏览器环境](http://oss.alienhe.cn/20200915204203.png)

上面的脑图中是在还原携程eleven参数时所需要补齐的浏览器环境，其中有几项是较为偏僻的反爬措施。

下面就列举了需要额外注意的几个地方：
# Object.freeze()
https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze

在正常的JS环境中，window和navigator等属于不可变对象，而在模拟浏览器环境时由于是自定义的对象，所以很容易被检测出来是在模拟，因此模拟完毕后，记得Object.freeze()一下

# 异常堆栈检测
异常堆栈检测在安卓中也是常用的反hook检测手段，在JS中，可以通过检测堆栈来判断所处的执行环境，例如Node环境的特征为「/modules/cjs/loader」，绕过方式也特别简单：
```
// 直接重写String的查找方法
var _indexOf = String.prototype.indexOf;
String.prototype.indexOf = function (searchValue, fromIndex) {
        if (searchValue == '/modules/cjs/loader') {
            return -1;
        }
        return _indexOf.apply(this, [searchValue, fromIndex]);
    }
```

# native方法检测
在JS中存在许多native方法，其中某些方法也是node环境中所不存在需要模拟的，针对这类方法，携程可以通过打印该方法判断该方法是否被重写，因此绕过方式也是重写Function的toString方法：
```
    var originString = Function.prototype.toString;
    // native方法检测
    Function.prototype.toString = function () {
        if (this == Window || this == Location || this == Function.prototype.toString) {
            return "function Window() { [native code] }";
        }
        return originString.apply(this);
    };
```

# canvas指纹
canvas指纹是浏览器指纹中绕不开的存在，通过不同设备绘制图片时的细微差异来标识不同的浏览器。

一般的JS在获取该信息时，通常是直接绘制一次图片来获取指纹，但实际上在模拟时有很多需要注意的地方，比如：
1. 不同类型图片的canvas指纹应当不一样，如.jpg .png
2. 不同质量quality的canvas指纹应该不一样
3. 不同属性的canvas指纹应该不一样
4. 同一个条件的canvas多次绘制时应该保持一致

# 自动化痕迹检测
自动化痕迹虽然不是node环境补齐浏览器环境需要考虑的东西，但在携程的反爬JS中也是可以看到二十多项检测自动化属性的地方，因此自动化痕迹也是前端所需要知悉的一个对抗点。

目前已知的较为完美绕过自动化框架检测的一个办法是使用无头chrome浏览器或jvppeteer：

https://intoli.com/blog/not-possible-to-block-chrome-headless/

https://github.com/fanyong920/jvppeteer

# 浏览器指纹
通过携程的反爬JS也可以看出来携程在JS中搜集的浏览器指纹，虽然在浏览器中获取指纹其实并不可靠，获取的信息也并不权威。

常见的浏览器指纹信息：
* window.screen 屏幕分辨率/宽高
* navigator.useragent
* location.href/host
* navigator.platform 平台、语言等信息
* canvas
* navigator.plugin 浏览器插件信息