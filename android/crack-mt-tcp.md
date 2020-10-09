## 全协议追踪分析
请求数据加密方法：
com.dianping.nvnetwork.tunnel.tool.c#b


secureProtocolData.array组成：
payLoad + securePayLoad


发送请求
HTTP请求 Retrofit/OkHttp 
CallAdapter.adapt(loadServiceMethod,ClientCall)
根据ClientCall.execute -> 最终追溯到RawCall.execute
NvNetworkCallFactory$DpCall -> com.dianping.nvnetwork.l execSync = this.nvNetworkService.execSync(this.dpRequest); // 这步还将RetrofitRequest转化为DpRequest(DpRequestConverter)
中间有一系列的RxJava异步编程，非常复杂，在追踪的时候只关系根据实现的call方法最终可以定位到如何转换成长连接进行发送
其中重要的一个方法com.dianping.nvnetwork.fork.a#a(com.dianping.nvnetwork.Request)，用于根据Request判断采用哪种方式例如wns、cip，这个方法的返回值是一个接口，有多种实现类型
正常情况下可能需要跟踪代码逻辑，虽然逻辑非常复杂，但是在可以hook的情况下，我们直接打印方法返回类型，直接锁定正常情况下使用的HttpService（com.dianping.nvnetwork.failover.e）。

一顿追踪Hook全局搜索，最终可以发现Request会被包装成一个Runnable，com.dianping.nvnetwork.tunnel.d#exec
在Runnable中会被添加到一个BlockingQueue中：com.dianping.nvnetwork.tunnel.e.b#run，
由另外一个线程定时从队列中取出进行执行：com.dianping.nvnetwork.tunnel.e.a#run


com.dianping.nvnetwork.tunnel2.h#a(com.dianping.nvnetwork.tunnel.g)


retrofit.Request -> nvnetwork.Request -> com.dianping.nvnetwork.tunnel.g：
	1.DpRequestConverter
	2.com.dianping.nvnetwork.tunnel.d#a(com.dianping.nvnetwork.Request)

请求响应
NIOSelectorHelper 
while(true)监听Selector事件
selectionKey.isConnectable()
selectionKey.isReadable()

请求数据格式
-1 1 0 flag isSecure ? 1: 0 totalLength noSecureLength array
响应数据格式
255 version deviceType flag isSecure totalLength


请求密钥
1. 模拟请求密钥
2. 解析响应SecureProtocolData获得ParseData
3. rsa解密ParseData.secureLoad
4. 

问题：
源码丢失 -》 smali
1. smali 参数寄存器从1开始，0为当前对象
2. 可能有基本类型和引用类型粘贴的情况，
p3 = secureProtocolData.array
p3 = SecurTools.parseData(p3)
p3 = p3.secureLoad
p3 = this.a(p3)
if(this.d){
	v0 = this.g
	v1 = p3.b
	v0 = v0.a(v1)
	...
	this.g.a(a2.a, v0, a2.f);
}else{
	goto cond3
}



申请密钥：

Http请求到CIP请求的RequestAdapter：
	com.sankuai.meituan.retrofit2.utils_nvnetwork.DpRequestConverter#convert
	com.sankuai.meituan.retrofit2.Request ->> com.dianping.nvnetwork.Request

M-SHARK-TRACEID生成算法：
	java.lang.StringBuilder sb = new java.lang.StringBuilder();
    sb.append(a2.b);
    sb.append(1);
    // traceIdManager com.meituan.android.base.BaseConfig.uuid
    sb.append(com.dianping.nvnetwork.util.j.c.a());
    sb.append(a2.b());
    sb.append(java.lang.System.currentTimeMillis());
    sb.append(a2.b());
    str = sb.toString();
    request2.a((java.lang.String) "M-SHARK-TRACEID", str);

 pragma-mtid生成：
 		if (android.os.Build.VERSION.SDK_INT < 29) {
            return com.sankuai.common.utils.Utils.getDeviceId(context);
        }
        return com.meituan.android.common.statistics.Statistics.getUnionId();

 siua:
 	com.meituan.android.common.mtguard.MTGuard#userIdentification()

 mtgdid:
 	1.com.meituan.android.common.mtguard.DFPManager$1.run
 	2.com.meituan.android.common.dfingerprint.d.report(DFPReporter.java:50)
 	3.com.meituan.android.common.utils.mtguard.network.BaseReporter.report(BaseReporter.java:85)


美团retrofit请求响应流程：
	1. ClientCall enqueue or execute
	2. com.sankuai.meituan.retrofit2.ClientCall.this.parseResponse(com.sankuai.meituan.retrofit2.ClientCall.this.getResponseWithInterceptorChain(access$100.newBuilder().addHeader("retrofit_exec_time", java.lang.String.valueOf(currentTimeMillis)).build()))
	3. 之后经过一系列拦截器链，这里关键的拦截器为BridgeInterceptor，用于将响应数据GZIP解压

问题：
	1. SocketChannel建立连接后，是否有什么关键请求路径
	2. 请求报文中payload字段与securePayload字段含义
	3. 密钥超时机制

FetchIpListManager:
CIP赛马机制：同时发起多个IP的通道建立请求，同时根据所连接的不同的网络类型，保留最先建立成功的连接通道。（com.dianping.nvnetwork.tunnel2.c.a#a(com.dianping.nvnetwork.tunnel.b.a):ConnectionPoolManager）
	1. com.dianping.nvnetwork.tunnel.b#a(int)
	2. com.dianping.nvnetwork.tunnel.b#a(com.dianping.nvnetwork.tunnel.b, com.dianping.nvnetwork.Request, int)请求IPList（https://shark.dianping.com/api/loadbalance）
	3. com.dianping.nvnetwork.tunnel.b#a(com.dianping.nvnetwork.l) 处理和解密IPList请求响应数据，一是加密持久化至SharedReference，二是持久化到内存List中
	4. com.dianping.nvnetwork.tunnel2.i#i 消费list，构造SharkTunnelConnection List,并调用com.dianping.nvnetwork.tunnel2.a#a(int, com.dianping.nvnetwork.tunnel2.a.C0158a)方法建立连接（SocketChannel.connect）