# JVM中的JS执行引擎
在JVM中，常用的JS引擎有Google V8和JDK8之后自带的Nashorn。然而V8使用C++开发，若想要在JVM中使用，则需要编写JNI方法，因此一般推荐使用[J2V8](https://github.com/eclipsesource/J2V8)，该库已经帮我们封装好常用的API，但是一些 Native 的一些句柄对象如果不再使用的时候仍然需要我们调用 release() 去释放它们。

# J2V8和Nashorn的对比

引擎 |优点|缺点
---|---|---
J2V8|基于V8，支持Node环境的迁移|不同系统LINUX/WINDOWS/MACOS所依赖的POM版本不同
Nashorn|JDK自带，不用引入其他依赖|JS解析执行与V8可能有差异，项目中遇到过在J2V8中正常而Nashorn无法执行的问题

# J2V8 Quick Start
由于J2V8的相关文档较少，因此这里列出在项目中常用的API及注意事项。

## 创建V8运行时
要使用J2V8，必须首先创建一个V8运行时环境，J2V8为此提供了一个静态工厂方法。在创建一个运行时环境时，同时也会加载J2V8的本地库。
```
V8 runtime = V8.createV8Runtime();
```

## 执行JS脚本
V8提供了一系列的execute*方法，可以返回不同类型的结果，参数的核心是一个String类型的JS脚本字符串。

## 在Java中获取JS中的对象句柄
V8Object是底层JS中的对象的引用，我们可以通过V8#getObject(String)方法来获取。

## 在Java中调用JS中的函数
调用JS中的函数与获取JS中的对象类似，首先获取方法的实例对象，其次通过这个对象句柄调用execteFunction系列方法来完成函数调用，若需要传递方法参数，则需要使用V8Array对象。例如：
```
    V8Object v8Bridge = v8.getObject("bridge");
    params = new V8Array(v8).push(canvasData).push(userAgent).push(elevenJs);
    String res = v8Bridge.executeStringFunction("getEleven", params);
```

## 在JS中调用Java中的函数
在JS中也是同样可以实现调用Java中的函数，这种操作在WebView中非常常见，即JsBridge。在V8中，可以通过V8#registerJavaMethod来向JS注册Java方法，在JS中就可以调用该Java方法了。例如在js中注册一个打印日志的方法：
```
V8 runtime = V8.createV8Runtime();
            runtime.executeVoidScript(initJs);
            runtime.registerJavaMethod((v8Object, parameters) -> {
                if (parameters.length() > 0) {
                    Object arg1 = parameters.get(0);
                    System.out.println(arg1);
                    if (arg1 instanceof Releasable) {
                        ((Releasable) arg1).release();
                    }
                }
            }, "log");
```

## 多线程问题
J2V8中是支持多线程的，因此在许多方法中都加入了线程的判断，但这也导致了在不同线程无法互相访问V8runtime，因此在携程eleven项目中，对于每个线程都创建了一个V8运行时。