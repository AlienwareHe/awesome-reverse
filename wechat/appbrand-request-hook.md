小程序中主要通信方式有两种，一种为最常见的Http，另一种为WebSocket。从小程序架构中可以知道不论哪种方式都是通过微信客户端提供的 能力完成，因此是可以在Java层对这两种方式进行Hook。

以下的两种方式案例都是基于微信7.0.8完成，更高版本可能存在混淆导致类名有所变化，可根据特征自行查找修正。
# Http
com.android.okhttp.internal.huc.HttpURLConnectionImpl#getInputStream

通过HttpURLConnectionImpl#getURL方法可以区分出当前请求的接口地址，需要注意的是，该方法返回值是个IO流，只能被消费一次，因此需要我们额外进行 拷贝一份，以免影响到小程序逻辑。具体代码可参考：com.alienhe.crack_dianping_mini_tx.hook.http.InputStreamHook

# WebSocket
直接上代码，可以通过DDMS方法堆栈dump进行定位。
```
        /**
        * WebSocket相关
        */
        public static String webSocketInitClass = "com.tencent.mm.plugin.appbrand.jsapi.websocket.b";
        public static String webSocketInitMethod = "a";
        public static String webSocketTaskClass = "com.tencent.mm.plugin.appbrand.jsapi.websocket.a$1";
        public static String webSocketTaskOnMessageMethod = "Cv";


        /**
         *
         * 用于确认小程序中使用的WebSocket由哪个类实现SocketTask字节流的发送、接收、连接事件
         */
        RposedHelpers.findAndHookMethod(RposedHelpers.findClass(WxHookConstants.webSocketInitClass,
                loadPackageParam.classLoader), WxHookConstants.webSocketInitMethod,
                "com.tencent.mm.plugin.appbrand.jsapi.websocket.e.a",
                new RC_MethodHook() {
                    @Override
                    protected void beforeHookedMethod(MethodHookParam param) {
                        Log.i(TAG, "handle websocket on message class:" +
                                param.args[0].getClass().getName(), new Throwable());
                    }
                });

        /**
         * 监听SocketTask收到的消息事件，并处理酒店报价
         * @see 小程序API：SocketTask.onMessage(function callback)
         */
        RposedHelpers.findAndHookMethod(RposedHelpers.findClass(WxHookConstants.webSocketTaskClass,
                loadPackageParam.classLoader), WxHookConstants.webSocketTaskOnMessageMethod,
                "java.lang.String", new RC_MethodHook() {
                    @Override
                    protected void beforeHookedMethod(MethodHookParam param) {
                        final Object data = param.args[0];
                        for (WebSocketDataHandler handler : socketDataHandlerList) {
                            try {
                                handler.handle(data);
                            } catch (Throwable e) {
                                Log.e(TAG, "web socket handler handle socket error", e);
                            }
                        }
                    }
                });

```